// Render actual React components with fixture HTTP, not a production/authenticated journey.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {KnowledgeTestbench} from './components/app/knowledge-testbench';import {KnowledgeScopePanel} from './components/app/knowledge-scope';createRoot(document.getElementById('root')).render(<main style={{maxWidth:1000,margin:'30px auto',padding:24}}><h1>Test Opryn · Example fixture</h1>{location.search.includes('scope')?<KnowledgeScopePanel id="chunk" entity="knowledge" canManage/>:<KnowledgeTestbench people={[{id:'member',name:'Support Lead'}]} connections={[{id:'connection',name:'Support bot',status:'active'}]} knowledge={[{id:'chunk',title:'Refund limits',version:3}]} defaultActorId="member"/>}</main>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "router-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: a.path.endsWith("navigation")
            ? "export const useRouter=()=>({refresh(){}})"
            : 'import React from "react";export default function Link(p){return React.createElement("a",p,p.children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(resolve(".next/static/css", f), "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  res.setHeader(
    "content-type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? bundle.outputFiles[0].text
      : `<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="opryn-app" style="background:#fffcf7;color:#14213d"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
mkdirSync("artifacts/operational-platform", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  let payload,
    fail = false,
    saved = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/knowledge-tests", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { tests: saved } });
    payload = route.request().postDataJSON();
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: "Testing temporarily unavailable. Try again." },
      });
    const result = {
      question: payload.question || "Can I refund $700?",
      type: "answered",
      answer: "Owner approval is required above $500.",
      explanation: "Approved guidance under actual access.",
      missingContext: [],
      access: "Actual member permissions",
      testedAt: new Date().toISOString(),
      sources: [
        {
          id: "chunk",
          title: "Refund limits",
          source: "rule",
          version: 3,
          status: "Approved",
        },
      ],
    };
    if (payload.action === "save")
      saved = [
        {
          id: "test",
          title: payload.title,
          question: payload.question,
          expected_outcome: "answered",
          needsRerun: false,
          last_result: { ...result, comparison: { passed: true } },
        },
      ];
    if (payload.action === "delete") saved = [];
    await route.fulfill({ json: { result, comparison: { passed: true } } });
  });
  await page.route("**/api/knowledge-scope**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { scope: { regions: ["US"] }, current_version: 3 },
      });
    payload = route.request().postDataJSON();
    await route.fulfill({ json: { proposalId: "proposal" } });
  });
  for (const width of [1440, 390]) {
    saved = [];
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .getByRole("textbox", { name: "Ask a question" })
      .fill("Can I refund $700?");
    fail = true;
    await page
      .getByRole("button", { name: "Test answer", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await expect(
      page.getByRole("button", { name: "Test answer", exact: true }),
    ).toBeEnabled();
    fail = false;
    await page
      .getByRole("button", { name: "Test answer", exact: true })
      .click();
    await expect(
      page.getByText("Tested question: Can I refund $700?"),
    ).toBeVisible();
    await expect(page.getByText("Approved · v3 · rule")).toBeVisible();
    await page.getByText("Save an expected outcome", { exact: true }).click();
    await page.getByRole("textbox", { name: "Test title" }).fill("$700 refund");
    await page.getByRole("button", { name: "Save and run test" }).click();
    await expect(
      page.getByRole("button", { name: "Run test", exact: true }),
    ).toBeVisible();
    assert.equal(payload.action, "save");
    assert.equal(payload.actorId, "member");
    await page.screenshot({
      path: `artifacts/operational-platform/testbench-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Run test", exact: true }).click();
    assert.equal(payload.id, "test");
    await page.getByText("Actions", { exact: true }).click();
    await page.getByRole("button", { name: "Delete saved test" }).click();
    await expect(
      page.getByRole("button", { name: "Run test", exact: true }),
    ).toHaveCount(0);
    await page.goto(`http://127.0.0.1:${server.address().port}/?scope`);
    await expect(page.getByText("Regions: US", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit applicability" }).click();
    await page
      .getByRole("textbox", { name: "Regions", exact: true })
      .fill("US, Canada");
    await page.screenshot({
      path: `artifacts/operational-platform/scope-editor-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Create scope proposal" }).click();
    await expect(
      page.getByText("Scope proposal created.", { exact: false }),
    ).toBeVisible();
    assert.deepEqual(payload.scope.regions, ["US", "Canada"]);
    assert.equal(payload.version, 3);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await expect(
    page.getByRole("textbox", { name: "Ask a question" }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual testbench/scope components at desktop1440/mobile390, source/version/question evidence, failed-network recovery, save/rerun/delete payloads, scope proposal not direct approval, reduced motion, no overflow or console errors. Screenshots are fixtures.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
