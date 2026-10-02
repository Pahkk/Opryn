import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
const root = process.cwd(),
  output = resolve(root, "artifacts/motion-product");
mkdirSync(output, { recursive: true });
const bundle = await build({
  entryPoints: ["scripts/motion-product-fixture.jsx"],
  bundle: true,
  write: false,
  outfile: "fixture.js",
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "fixture-router",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "jsx",
          resolveDir: root,
          contents: a.path.endsWith("navigation")
            ? `export const useRouter=()=>({refresh(){},push(){},replace(){}});export const usePathname=()=>'/app/processes/new';export const useSearchParams=()=>new URLSearchParams();`
            : a.path.endsWith("link")
              ? `import React from 'react';export default function Link({children,prefetch,...p}){return <a {...p}>{children}</a>}`
              : `import React from 'react';export default function Image({fill,priority,unoptimized,...p}){return <img {...p}/>} `,
        }));
      },
    },
  ],
});
const css =
  readdirSync(".next/static/css")
    .filter((n) => n.endsWith(".css"))
    .map((n) => readFileSync(`.next/static/css/${n}`, "utf8"))
    .join("\n") + bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text;
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  const asset = resolve(root, "public", `.${req.url}`);
  if (
    asset.startsWith(resolve(root, "public") + "/") &&
    existsSync(asset) &&
    /\.(png|svg|webp)$/.test(asset)
  ) {
    res.setHeader(
      "Content-Type",
      asset.endsWith("svg")
        ? "image/svg+xml"
        : asset.endsWith("webp")
          ? "image/webp"
          : "image/png",
    );
    return res.end(readFileSync(asset));
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}.fixture-nav{display:flex;gap:12px;padding:16px;position:sticky;top:0;background:#fafaf9;z-index:2}.fixture-nav button{min-height:44px;padding:8px;border-bottom:1px solid #536b82}body{margin:0}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [1440, 1280, 1024, 768, 430, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      recordVideo: [1440, 390].includes(width)
        ? { dir: resolve(output, "recordings"), size: { width, height: 900 } }
        : undefined,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/content"))
        return route.fulfill({
          json: {
            available: [
              {
                externalId: "page-1",
                title: "Refund policy",
                sourceType: "page",
                parentContext: "Operations",
                modifiedAt: "2026-09-15",
              },
            ],
            selected: [],
          },
        });
      if (path.endsWith("/approve"))
        return route.fulfill({ json: { ok: true } });
      if (path.endsWith("/answer"))
        return route.fulfill({
          json: {
            answerId: "answer-1",
            title: "Refund approval limits",
            rule: "Managers may approve $300.",
            complete: true,
            clarificationQuestions: [],
            canApprove: true,
          },
        });
      if (path.endsWith("/resolve"))
        return route.fulfill({ json: { ok: true } });
      return route.fulfill({
        status: 503,
        json: { error: "Explicit fixture: service unavailable" },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const sourceRow = page.locator('.teach-source-row').first();
    const originalHeight = (await sourceRow.boundingBox()).height;
    await sourceRow.getByRole('button', { name: 'Choose files', exact: true }).focus();
    await expect.poll(() => sourceRow.locator('.opryn-trace rect').evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
    assert.equal((await sourceRow.boundingBox()).height, originalHeight, 'Focus feedback must not change row height');
    await page.getByPlaceholder('Search sources…').focus();
    await expect.poll(() => sourceRow.locator('.opryn-trace rect').evaluate(e => Number(getComputedStyle(e).opacity))).toBe(0);
    await page
      .getByRole("button", { name: "Choose pages or databases" })
      .click();
    await expect(
      page.getByText("Refund policy", { exact: true }),
    ).toBeVisible();
    assert.equal(await page.getByRole("dialog").count(), 0);
    checks++;
    await page.waitForTimeout(450);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    checks++;
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: resolve(output, `teach-expanded-${width}.png`),
        fullPage: true,
      });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Refund policy", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Choose pages or spaces" }).click();
    await expect(
      page.getByText("Refund policy", { exact: true }),
    ).toBeVisible();
    checks++;
    await page.getByRole("button", { name: "Close", exact: true }).click();
    for (const value of ["notion", "confluence", "google", ""])
      await page.getByPlaceholder("Search sources…").fill(value);
    await expect(page.locator(".teach-source-row:not([inert])")).toHaveCount(3);
    checks++;
    await page.getByRole("button", { name: "Needs You", exact: true }).click();
    await page
      .locator("#action-proposal-1")
      .getByRole("button", { name: /Accept/ })
      .click();
    await expect(
      page.getByText("Opryn knows this now.", { exact: true }).first(),
    ).toBeVisible();
    checks++;
    await page
      .getByRole("button", { name: /Clear completed decisions/ })
      .click();
    await expect(page.locator("#action-proposal-2")).toBeVisible();
    await expect(page.locator(".review-result")).toHaveCount(0);
    checks++;
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: resolve(output, `needs-resolved-${width}.png`),
        fullPage: true,
      });
    await page.getByRole("button", { name: "Knowledge", exact: true }).click();
    const knowledgeRow = page.locator('.library-row').first();
    await knowledgeRow.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(knowledgeRow).toBeFocused();
    await expect.poll(() => knowledgeRow.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(234, 244, 255)');
    await expect.poll(() => knowledgeRow.locator('small').evaluate(e => Number(getComputedStyle(e).opacity))).toBe(1);
    if ([1440, 390].includes(width)) await page.screenshot({ path: resolve(output, `knowledge-focus-${width}.png`) });
    await page.locator(".library-row").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.waitForTimeout(400);
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: resolve(output, `knowledge-detail-${width}.png`),
      });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    checks++;
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page
      .getByRole("button", { name: "Receive confirmed update" })
      .click();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
    checks++;
    await page.waitForTimeout(700);
    await page
      .getByPlaceholder("Answer the way you would explain it to an employee…")
      .fill("Managers may approve refunds up to $500.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Remember It", exact: true })
      .click();
    await expect(
      page.getByText("✓ Approved · added to company knowledge", {
        exact: true,
      }),
    ).toBeVisible();
    checks++;
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: resolve(output, `home-${width}.png`),
        fullPage: true,
      });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Teach", exact: true }).click();
    await page
      .getByRole("button", { name: "Choose pages or databases" })
      .click();
    await expect(
      page.getByText("Refund policy", { exact: true }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    await context.close();
  }
  console.log(
    `PASS ${checks} product Motion checks at all six requested widths. Explicit API doubles. Screenshots and recordings: ${output}`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
