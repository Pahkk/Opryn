// Rendered component fixtures, not a live authenticated workspace or provider test.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
assert.ok(process.env.OPRYN_ESBUILD_MODULE, "Set OPRYN_ESBUILD_MODULE");
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const root = process.cwd();
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {OwnerAnswer} from './components/app/owner-answer';import {GapRecheck} from './components/app/gap-recheck';createRoot(document.getElementById('root')).render(<main style={{maxWidth:680,margin:'40px auto',padding:24}}><p>Needs You · Example fixture</p><h1>Refund approval limits</h1><p>Can a manager approve a $700 refund?</p>{location.search.includes('recheck') ? <GapRecheck proposalId="40000000-0000-4000-8000-000000000001"/> : <OwnerAnswer questionId="30000000-0000-4000-8000-000000000001" />}</main>);`,
    resolveDir: root,
    loader: "jsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: { "@": root },
  plugins: [
    {
      name: "fixture-router",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({
          path: args.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents:
            args.path === "next/link"
              ? "import React from 'react';export default function Link(props){return React.createElement('a',props)};"
              : "export const useRouter=()=>({refresh:()=>{window.fixtureRefresh=true}});",
          loader: "js",
          resolveDir: root,
        }));
      },
    },
  ],
});
const dir = resolve(root, ".next/static/css");
const css = readdirSync(dir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(resolve(dir, f), "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? bundle.outputFiles[0].text
      : `<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body style="background:#fffcf7;color:#14213d"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
mkdirSync("artifacts/operational-platform", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let payload;
  await page.route("**/api/questions/*/answer", async (route) => {
    const p = route.request().postDataJSON();
    await route.fulfill({
      json: {
        answerId: "40000000-0000-4000-8000-000000000001",
        title: p.oneTimeException
          ? "One-time exception"
          : "Refund approval limits",
        rule: p.answer,
        complete: true,
        clarificationQuestions: [],
        canApprove: !p.oneTimeException,
      },
    });
  });
  await page.route("**/api/questions/*/resolve", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        ok: true,
        learned: false,
        awaitingApproval: payload.action === "request_approval",
      },
    });
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .getByRole("textbox")
      .fill("Managers must request owner approval above $500.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Create knowledge proposal" }),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/operational-platform/human-answer-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Create knowledge proposal" })
      .click();
    assert.equal(payload.action, "request_approval");
    assert.equal(payload.oneTimeException, false);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole("textbox").fill("For this customer only, refund $800.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create knowledge proposal" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/operational-platform/one-time-390.png",
  });
  await page.getByRole("button", { name: "Just Answer" }).click();
  assert.equal(payload.action, "answer_only");
  assert.equal(payload.oneTimeException, true);
  let recheckRequests = 0;
  await page.route("**/api/knowledge-proposals/*/recheck", async (route) => {
    recheckRequests++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill(
      recheckRequests === 1
        ? {
            status: 503,
            json: { error: "The recheck could not finish. Try again." },
          }
        : { json: { ok: true, results: [{ status: "unknown" }] } },
    );
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}/?recheck`);
    await expect(
      page.getByRole("link", { name: "Teach more detail" }),
    ).toHaveAttribute("href", "/app/processes/new");
    await page.screenshot({
      path: `artifacts/operational-platform/gap-recheck-${width}.png`,
    });
    await page.getByRole("button", { name: "Recheck questions" }).click();
    await expect(
      page.getByRole("button", { name: "Checking approved guidance…" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Recheck questions" }),
    ).toBeEnabled();
    await expect(page.getByRole("status")).toContainText(
      width === 1440 ? "Try again." : "Some questions still need",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.equal(recheckRequests, 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS rendered proposal/one-time flows, payloads, desktop/mobile sizing and no browser errors. Explicit fixtures only.",
  );
} finally {
  await browser.close();
  server.close();
}
