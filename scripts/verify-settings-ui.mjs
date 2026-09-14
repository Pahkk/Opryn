import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
const root = process.cwd(),
  out = resolve("artifacts/settings-foundation");
mkdirSync(out, { recursive: true });
const bundle = await build({
  entryPoints: [resolve("scripts/settings-ui-fixture.jsx")],
  bundle: true,
  write: false,
  outfile: "fixture.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": root },
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.supabase.co"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
      '"fixture-not-a-credential"',
  },
  plugins: [
    {
      name: "router-test-double",
      setup(builder) {
        builder.onResolve(
          { filter: /^next\/(navigation|link|image)$/ },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "jsx",
          resolveDir: root,
          contents: args.path.endsWith("navigation")
            ? `export const usePathname=()=>location.pathname; export const useRouter=()=>({refresh:()=>window.dispatchEvent(new Event('fixture-refresh')),push:href=>location.assign(href),replace:href=>location.replace(href)});export const useSearchParams=()=>new URLSearchParams(location.search);`
            : args.path.endsWith("image")
              ? `import React from 'react';export default function Image({priority,unoptimized,fill,style,...props}){return <img {...props} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{}),...style}}/>;}`
              : `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>;}`,
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(resolve(".next/static/css", name), "utf8"))
  .join("\n");
const server = createServer((request, response) => {
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  if (request.url === "/opryn-logo.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(readFileSync("public/opryn-logo.png"));
    return;
  }
  response.setHeader("Content-Type", "text/html");
  response.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? ""}</style></head><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
let account = {
  display_name: "Alex Example",
  timezone: "UTC",
  timezone_overridden: false,
  locale: "en-US",
  density: "comfortable",
  motion: "system",
  notify_questions: true,
  notify_reviews: true,
  notify_answers: true,
  avatar_path: null,
  avatar_hidden: false,
  revision: 1,
};
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/__fixture/account", (route) =>
    route.fulfill({ json: account }),
  );
  let failures = false,
    stale = false,
    saves = 0;
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Fixture network failure. Please retry." },
    }),
  );
  await page.route("**/api/account", (route) => {
    if (failures) return route.abort();
    if (stale)
      return route.fulfill({
        status: 409,
        json: {
          error:
            "Your settings changed in another tab. Reload this page before saving.",
        },
      });
    const body = route.request().postDataJSON();
    check(body.revision === account.revision, "expected profile revision");
    saves++;
    account = { ...account, ...body.changes, revision: account.revision + 1 };
    return route.fulfill({ json: { settings: account } });
  });
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of [
      "profile",
      "preferences",
      "notifications",
      "security",
      "general",
      "knowledge",
      "billing",
      "settings",
    ]) {
      await page.goto(
        `${base}/app/settings/${section === "settings" ? "" : section}`,
      );
      await page.locator(".settings-shell").waitFor();
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${section} no overflow ${width}`,
      );
      check(
        (await page.locator("h1").count()) === 1,
        `${section} one heading ${width}`,
      );
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: resolve(out, `${section}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${base}/app/settings/profile`);
  await page.getByLabel("Display name", { exact: true }).fill("Alex Saved");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your changes are saved." })
    .waitFor();
  check(saves === 1, "single profile save");
  await page.reload();
  await page.getByLabel("Display name", { exact: true }).waitFor();
  check(
    (await page.getByLabel("Display name", { exact: true }).inputValue()) ===
      "Alex Saved",
    "profile survives reload with server-returned fixture state",
  );
  await page.getByLabel("Display name", { exact: true }).fill("Unsaved name");
  await page.getByLabel("Search settings", { exact: true }).fill("change name");
  await page.getByLabel("Search settings", { exact: true }).fill("");
  check(
    (await page.getByLabel("Display name", { exact: true }).inputValue()) ===
      "Unsaved name",
    "search does not discard edits",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("combobox", { name: "Active business" })
    .selectOption("20000000-0000-4000-8000-000000000002");
  check(
    (await page.getByLabel("Display name", { exact: true }).inputValue()) ===
      "Unsaved name",
    "cancel workspace switch preserves form",
  );
  stale = true;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").waitFor();
  check(
    (await page.getByRole("alert").textContent()).includes("another tab"),
    "stale revision explained",
  );
  stale = false;
  failures = true;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('[role="alert"]')?.textContent.includes("fetch"),
  );
  check(
    !(await page
      .getByRole("button", { name: "Save changes", exact: true })
      .isDisabled()),
    "network failure permits retry",
  );
  failures = false;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your changes are saved." })
    .waitFor();
  await page.goto(`${base}/app/settings/preferences`);
  await page
    .getByLabel("Information density", { exact: true })
    .selectOption("compact");
  await page.getByLabel("Reduce interface motion").check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector(".opryn-app")?.dataset.density === "compact",
  );
  check(
    (await page.locator(".opryn-app").getAttribute("data-motion")) ===
      "reduced",
    "saved preferences applied to shell",
  );
  await page.reload();
  await page.getByLabel("Information density", { exact: true }).waitFor();
  check(
    (await page
      .getByLabel("Information density", { exact: true })
      .inputValue()) === "compact",
    "preferences persist after reload",
  );
  await page.goto(`${base}/app/settings/notifications?employee=1`);
  await page.getByLabel("Questions needing my answer").uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your changes are saved." })
    .waitFor();
  check(!account.notify_questions, "personal in-app notification save");
  await page
    .getByLabel("Search settings", { exact: true })
    .fill("cancel subscription");
  check(
    (await page.getByRole("link", { name: "Billing & Usage" }).count()) === 0,
    "employee settings search hides billing",
  );
  await page.getByLabel("Search settings", { exact: true }).fill("");
  await page.goto(`${base}/app/settings/security?google=1`);
  await page.locator(".settings-pane").waitFor();
  check(
    (await page.getByRole("link", { name: "Reset password" }).count()) === 0,
    "Google-only account not offered password reset",
  );
  await page.goto(`${base}/app/settings/billing`);
  await page.locator(".settings-pane").waitFor();
  const billingButton = page.getByRole("button", {
    name: /Manage billing|Manage subscription|Manage Billing/,
  });
  if (await billingButton.count()) {
    await billingButton.click();
    await page.getByRole("alert").waitFor();
    check(!(await billingButton.isDisabled()), "billing failure unlocks retry");
  } else throw new Error("Billing management action missing");
  await page.goto(`${base}/app/settings/profile`);
  await page.getByRole("button", { name: "Open profile menu" }).click();
  check(
    (await page
      .getByRole("link", { name: "My Profile", exact: true })
      .count()) >= 1,
    "avatar menu opens profile",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page
    .getByRole("dialog", { name: "Search company knowledge" })
    .waitFor();
  check(true, "global search keyboard shortcut");
  await page.keyboard.press("Escape");
  await page.getByLabel("Choose profile photo").setInputFiles({
    name: "example.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page.getByRole("alert").waitFor();
  check(
    (await page.getByRole("alert").textContent()).includes("PNG"),
    "unsafe avatar rejected",
  );
  check(errors.length === 0, `no page errors: ${errors.join("; ")}`);
  console.log(
    `Settings UI: ${assertions} assertions passed (real components, mocked account/provider APIs). Screenshots: ${out}`,
  );
} finally {
  await browser.close();
  server.close();
}
