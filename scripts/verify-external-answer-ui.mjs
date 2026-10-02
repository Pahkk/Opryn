// Real component, isolated response fixtures: not authenticated production E2E.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
assert.ok(process.env.OPRYN_ESBUILD_MODULE, "Set OPRYN_ESBUILD_MODULE");
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const root = process.cwd();
const result = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {EscalationCard} from './components/app/ai-connections';createRoot(document.getElementById('root')).render(<main style={{maxWidth:680,margin:'40px auto',padding:20}}><h1>AI connection · Example fixture</h1><EscalationCard connectionId="30000000-0000-4000-8000-000000000001" item={{id:'40000000-0000-4000-8000-000000000001',question:'Can managers approve a $700 refund?',context:'Support question',status:'open',resolution:null,proposed_rule:null,created_at:'2026-09-16T00:00:00Z'}} onDone={()=>{window.fixtureDone=true}} /></main>);`,
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
      name: "fixture-next",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|navigation)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "next/link"
              ? "import React from 'react';export default function Link(props){return React.createElement('a',props)}"
              : "export const useRouter=()=>({refresh:()=>{}});",
          loader: "js",
          resolveDir: root,
        }));
      },
    },
  ],
});
const cssDir = resolve(root, ".next/static/css");
const css = readdirSync(cssDir)
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(resolve(cssDir, f), "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? result.outputFiles[0].text
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
  let payload,
    fail = false;
  await page.route(
    "**/api/ai-connections/*/escalations/*/answer",
    async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill(
        fail
          ? { status: 503, json: { error: "Could not save. Try again." } }
          : {
              json:
                payload.action === "suggest"
                  ? {
                      rule: "Owner approval required above $500.",
                      complete: true,
                      clarificationQuestions: [],
                    }
                  : {
                      ok: true,
                      learned: false,
                      awaitingApproval: payload.action === "request_approval",
                      proposalId: "50000000-0000-4000-8000-000000000001",
                    },
            },
      );
    },
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .getByRole("textbox")
      .fill("Owner approval is required above $500.");
    await page
      .getByRole("button", { name: "Prepare knowledge proposal" })
      .click();
    await expect(
      page.getByRole("button", { name: "Create knowledge proposal" }),
    ).toBeVisible();
    fail = true;
    await page
      .getByRole("button", { name: "Create knowledge proposal" })
      .click();
    await expect(page.getByRole("alert")).toHaveText(
      "Could not save. Try again.",
    );
    await expect(
      page.getByRole("button", { name: "Create knowledge proposal" }),
    ).toBeEnabled();
    fail = false;
    await page
      .getByRole("button", { name: "Create knowledge proposal" })
      .click();
    assert.equal(payload.action, "request_approval");
    assert.equal(payload.oneTimeException, false);
    await expect(
      page.getByRole("link", { name: "Review proposal" }),
    ).toHaveAttribute(
      "href",
      "/app/needs-you?item=50000000-0000-4000-8000-000000000001",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `artifacts/operational-platform/external-answer-${width}.png`,
    });
  }
  await page.reload();
  await page.getByRole("textbox").fill("For this customer only, approve $800.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save answer only" }).click();
  assert.equal(payload.action, "answer_only");
  assert.equal(payload.oneTimeException, true);
  await expect.poll(() => page.evaluate(() => window.fixtureDone)).toBe(true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: external answer UI at 1440/390, pending proposal/link, exception-only payload, failed request recovery, no overflow/browser errors. Fixture evidence only.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
