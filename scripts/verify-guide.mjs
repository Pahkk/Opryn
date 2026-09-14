import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, webkit, expect } from "@playwright/test";

const root = process.cwd();
const pure = await build({
  stdin: {
    contents:
      'export * from "./lib/guide/registry"; export * from "./lib/guide/schema";',
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const registry = await import(
  `data:text/javascript;base64,${Buffer.from(pure.outputFiles[0].text).toString("base64")}`
);
const facts = {
  source: false,
  approved: false,
  answered: false,
  team: false,
  connection: false,
  google: false,
  pending: false,
};
assert.equal(registry.canGuideTarget("team.invite", "employee"), false);
assert.equal(registry.canGuideTarget("team.invite", "admin"), true);
assert.equal(registry.canGuideTarget("__proto__", "owner"), false);
assert.equal(registry.canGuideTarget("button[onclick]", "owner"), false);
assert.equal(
  registry.authorizeReply(
    { message: "x", suggestedTargets: ["team.invite"], guideId: null },
    "employee",
    facts,
  ),
  null,
);
assert.equal(
  registry.guideRequestSchema.safeParse({
    action: "execute_javascript",
    code: "alert(1)",
  }).success,
  false,
);
assert.equal(
  registry.guideRequestSchema.safeParse({
    action: "show",
    targetId: "teach.google",
    selector: "body",
  }).success,
  false,
);
assert.equal(
  registry.guideSteps("setup-opryn", "owner", {
    ...facts,
    source: true,
    approved: true,
  })[0].targetId,
  "ask.question",
);
assert.equal(registry.guideSteps("setup-opryn", "employee", facts).length, 1);
for (const target of Object.values(registry.guideTargets))
  assert.ok(
    existsSync(
      path.join(root, "app", target.route.split("?")[0], "page.tsx"),
    ) || target.route.includes("/settings/"),
  );
console.log(
  "PASS registry: permissions, injected selectors/actions, completed-step filtering, registered routes",
);

const bundle = await build({
  entryPoints: ["scripts/guide-ui-fixture.jsx"],
  bundle: true,
  write: false,
  outfile: "guide.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": root },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.invalid"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '"sample-not-a-key"',
  },
  plugins: [
    {
      name: "fixture-navigation",
      setup(b) {
        b.onResolve(
          { filter: /^next\/(navigation|link|image|dynamic)$/ },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "jsx",
          resolveDir: root,
          contents: a.path.endsWith("navigation")
            ? `import {useSyncExternalStore} from 'react';const sub=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)};const snap=()=>location.href;const router={push(url){history.pushState({},'',url);dispatchEvent(new PopStateEvent('popstate'))},replace(url){history.replaceState({},'',url);dispatchEvent(new PopStateEvent('popstate'))},refresh(){dispatchEvent(new PopStateEvent('popstate'))}};export const useRouter=()=>router;export const usePathname=()=>new URL(useSyncExternalStore(sub,snap)).pathname;export const useSearchParams=()=>new URL(useSyncExternalStore(sub,snap)).searchParams;`
            : a.path.endsWith("dynamic")
              ? `import React,{lazy,Suspense} from 'react';export default function dynamic(load){const C=lazy(()=>load().then(defaultExport=>({default:defaultExport})));return function Lazy(p){return <Suspense fallback={null}><C {...p}/></Suspense>}}`
              : a.path.endsWith("link")
                ? `import React from 'react';export default function Link({prefetch,onClick,...p}){return <a {...p} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&p.href.startsWith('/')){e.preventDefault();history.pushState({},'',p.href);dispatchEvent(new PopStateEvent('popstate'))}}}/>} `
                : `import React from 'react';export default function Image({fill,priority,unoptimized,...p}){return <img {...p}/>}`,
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((n) => n.endsWith(".css"))
  .map((n) => readFileSync(`.next/static/css/${n}`, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  if (name === "/guide.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  const asset = path.resolve("public", `.${name}`);
  if (
    asset.startsWith(path.resolve("public") + path.sep) &&
    existsSync(asset) &&
    /\.(svg|png|webp)$/.test(asset)
  ) {
    res.setHeader(
      "Content-Type",
      asset.endsWith("svg") ? "image/svg+xml" : "image/png",
    );
    return res.end(readFileSync(asset));
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text || ""}</style><div id="root"></div><script src="/guide.js"></script></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
mkdirSync("artifacts/guide", { recursive: true });
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [engineName, engine, width, reduced] of [
    ["chromium", chromium, 1440, false],
    ["chromium", chromium, 390, false],
    ["webkit", webkit, 430, true],
    ["chromium", chromium, 360, true],
    ["chromium", chromium, 768, false],
  ]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let state = {
        userId: "fixture-user",
        organizationId: "fixture-org",
        role: "owner",
        facts: { ...facts },
      };
      let mutations = 0;
      let delayShow = false;
      await page.route("**/api/**", async (route) => {
        const request = route.request();
        if (!request.url().endsWith("/api/guide")) {
          if (request.method() !== "GET") mutations++;
          return route.fulfill({
            json: { imports: [], attempts: [], connections: [], intent: null },
          });
        }
        const action =
          request.method() === "POST" ? request.postDataJSON() : null;
        if (delayShow && action?.action === "show")
          await new Promise((resolve) => setTimeout(resolve, 700));
        if (action?.action === "show")
          return route.fulfill({
            json: {
              ...state,
              steps: [{ targetId: action.targetId }],
              title: "Show me",
            },
          });
        if (action?.action === "start")
          return route.fulfill({
            json: {
              ...state,
              steps: registry.guideSteps(
                action.guideId,
                state.role,
                state.facts,
              ),
              title: registry.guides[action.guideId].title,
            },
          });
        if (action?.action === "ask")
          return route.fulfill({
            json: {
              message:
                "Choose Google Workspace inside Teach. You decide which files to share.",
              suggestedTargets: ["teach.google"],
              guideId: "connect-google",
            },
          });
        return route.fulfill({ json: state });
      });
      await page.goto(`${origin}/app`);
      await page
        .getByRole("button", { name: "Opryn Guide", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Opryn Guide", exact: true }),
      ).toBeVisible();
      await page.waitForFunction(() => {
        const el = document.querySelector(".guide-panel");
        return (
          el && getComputedStyle(el).opacity === "1" && !el.style.transform
        );
      });
      await page.screenshot({
        path: `artifacts/guide/panel-${engineName}-${width}.png`,
      });
      await page
        .getByLabel("Ask about using Opryn", { exact: true })
        .fill("Where do I connect Google?");
      await page.getByRole("button", { name: "Ask", exact: true }).click();
      await page
        .getByRole("button", {
          name: "Show me: Choose Google files →",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(`${origin}/app/processes/new`);
      await expect(page.locator(".opryn-guide-coach")).toBeVisible();
      await expect(page.locator('[data-guide="teach.google"]')).toHaveClass(
        /driver-active-element/,
      );
      await expect(
        page.getByRole("button", { name: "Finish guide", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Exit guide", exact: true }),
      ).toBeVisible();
      await page.waitForFunction(
        () =>
          !!document.activeElement?.closest(
            ".driver-popover, .driver-active-element",
          ),
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(
          () =>
            !!document.activeElement?.closest(
              ".driver-popover, .driver-active-element",
            ),
        ),
        true,
        "keyboard focus remains in the coach/target",
      );
      await page.waitForFunction(() => {
        const el = document.querySelector(".opryn-guide-coach");
        return (
          el &&
          el.getAnimations().every((a) => a.playState === "finished") &&
          getComputedStyle(el).opacity === "1"
        );
      });
      // Pointer is an optional one-shot cue; spotlight remains after it disappears.
      await expect(page.locator(".opryn-guide-pointer")).toBeHidden();
      await page.setViewportSize({ width: width - 10, height: 900 });
      await expect(page.locator(".opryn-guide-coach")).toBeVisible();
      await expect(page.locator(".opryn-guide-pointer")).toBeHidden();
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: `artifacts/guide/spotlight-${engineName}-${width}.png`,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.keyboard.press("Escape");
      await expect(page.locator(".driver-overlay")).toHaveCount(0);
      assert.equal(mutations, 0, "Guide must never submit a product mutation");

      // Real target click pauses the overlay, without the guide doing the click itself.
      await page
        .getByRole("button", { name: "Opryn Guide", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Teach in your own words Show me →",
          exact: true,
        })
        .click();
      await expect(page.locator(".opryn-guide-coach")).toBeVisible();
      await page.locator('[data-guide="teach.explain"]').click();
      await expect(page.locator(".driver-overlay")).toHaveCount(0);
      await expect(page.locator(".guide-resume")).toBeVisible();
      await page.reload();
      await expect(page.locator(".guide-resume")).toBeVisible();
      assert.equal(
        await page.locator(".driver-overlay").count(),
        0,
        "reload/OAuth return cannot obscure provider UI",
      );
      await page
        .getByRole("button", { name: "Show this step", exact: true })
        .click();
      await expect(page.locator(".opryn-guide-coach")).toBeVisible();
      await page.keyboard.press("Escape");

      if (width === 1440) {
        // Advancing a tour is NOT backend completion. Follow verified milestones only.
        await page
          .getByRole("button", { name: "Opryn Guide", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Let's do it together", exact: false })
          .click();
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.locator(".guide-resume")).toContainText(
          "Complete “Teach your first source”",
        );
        state.facts.source = true;
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await expect(page).toHaveURL(`${origin}/app/needs-you`);
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        await page.getByRole("button", { name: "Back", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/app/processes/new`);
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/app/needs-you`);
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        state.facts.approved = true;
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page).toHaveURL(`${origin}/app/ask`);
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        state.facts.answered = true;
        await page
          .getByRole("button", { name: "Finish guide", exact: true })
          .click();
        await expect(page.locator(".driver-overlay")).toHaveCount(0);
        await page.goto(`${origin}/app`);
        await expect(
          page.getByRole("button", { name: "Opryn Guide", exact: true }),
        ).toBeVisible();
        await expect(page.locator(".guide-setup-strip")).toHaveCount(0);

        // Missing targets time out without leaving the app dimmed; retry is recoverable.
        await page.goto(`${origin}/app/processes/new`);
        await page
          .locator('[data-guide="teach.upload"]')
          .evaluate((el) => el.removeAttribute("data-guide"));
        await page
          .getByRole("button", { name: "Opryn Guide", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Start with a file Show me →",
            exact: true,
          })
          .click();
        await expect(
          page.getByRole("button", { name: "Retry target", exact: true }),
        ).toBeVisible({ timeout: 12000 });
        await expect(page.locator(".driver-overlay")).toHaveCount(0);
        await page
          .getByRole("button", { name: "Upload something", exact: false })
          .evaluate((el) => el.setAttribute("data-guide", "teach.upload"));
        await page
          .getByRole("button", { name: "Retry target", exact: true })
          .click();
        await expect(page.locator(".opryn-guide-coach")).toBeVisible();
        await page.keyboard.press("Escape");
        console.log(
          "PASS multi-step: real completion gates, cross-route Back/Next, activation, missing-target timeout/retry",
        );
        delayShow = true;
        await page
          .getByRole("button", { name: "Opryn Guide", exact: true })
          .click();
        const delayed = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/guide") &&
            response.request().postData()?.includes('"action":"show"'),
        );
        await page
          .getByRole("button", {
            name: "Start with a file Show me →",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Close Opryn Guide", exact: true })
          .click();
        await delayed;
        await expect(page.locator(".opryn-guide-coach")).toHaveCount(0);
        await expect(page.locator(".guide-resume")).toHaveCount(0);
        delayShow = false;
        console.log("PASS close during pending request: no delayed tour opens");
      }

      // Changed membership/workspace does not hydrate another tenant's saved guide.
      state = { ...state, organizationId: "other-org", role: "employee" };
      await page.goto(`${origin}/app?org=other-org&employee=1`);
      await page
        .getByRole("button", { name: "Opryn Guide", exact: true })
        .click();
      await expect(page.locator(".guide-resume")).toHaveCount(0);
      await page.getByText("Guided workflows", { exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Invite your team", exact: true }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${engineName} ${width}px reduced=${reduced}: panel, cross-route target, pointer, Esc, user action, reload resume, tenant isolation, employee actions`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
