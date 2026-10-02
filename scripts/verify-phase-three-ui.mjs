// Actual React views, isolated HTTP/fixtures. Not an authenticated Supabase E2E.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const source = {
  id: "source",
  integration_id: "connection",
  provider: "confluence",
  title: "Refund Policy",
  sync_status: "changed",
  process_id: "pending",
  approved_process_id: "approved",
  provider_version: "4",
  modified_at: "2026-09-16T12:00:00Z",
  last_checked_at: "2026-09-16T12:00:00Z",
  last_successful_check_at: "2026-09-16T12:00:00Z",
  last_imported_at: "2026-09-16T12:00:00Z",
  connectionStatus: "connected",
  reason: "Findings awaiting review",
  previous_content: "Managers may approve refunds up to $500.",
  normalized_content: "Managers may approve refunds up to $750.",
};
const impact = {
  item: {
    id: "chunk",
    content: "Refund limits: Managers may approve up to $500.",
    approved: true,
    current_version: 3,
    source_type: "rule",
    scope: { regions: ["US"] },
  },
  title: "Refund approval limits",
  sourceTitle: "Refund Policy",
  sourceUrl: null,
  predecessor: null,
  related: [
    {
      id: "related",
      content: "Refund escalation process",
      approved: true,
      current_version: 2,
    },
  ],
  tests: [
    {
      id: "test",
      title: "$700 refund",
      expected_outcome: "answered",
      last_run_at: null,
    },
  ],
  questionCount: 17,
  permitted: [{ id: "support", name: "Support bot" }],
  source,
  replacedIds: [],
  limited: false,
};
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{KnowledgeImpactView}from'./components/app/knowledge-impact';import{SourceFreshnessList}from'./components/app/source-freshness';import{ConflictReplacement}from'./components/app/conflict-replacement';const source=${JSON.stringify(source)};const impact=${JSON.stringify(impact)};createRoot(document.getElementById('root')).render(<main style={{maxWidth:1000,margin:'24px auto',padding:20}}><p>Example fixture · no customer data</p>{location.search.includes('conflict')?<ConflictReplacement id="conflict" firstVersion={3} secondVersion={2} applicability="regions: US"/>:location.search.includes('freshness')?<><h1>Knowledge Health · Source Updates</h1><SourceFreshnessList sources={[source]} limited={false}/></>:<KnowledgeImpactView impact={impact}/>}</main>);`,
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
            ? "export const useRouter=()=>({refresh(){window.fixtureRefreshes=(window.fixtureRefreshes||0)+1}})"
            : 'import React from"react";export default function Link(p){return React.createElement("a",p,p.children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(`.next/static/css/${f}`, "utf8"))
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
const output = "artifacts/operational-platform";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: {
    dir: `${output}/phase-three-video`,
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage();
let payload,
  fail = false,
  calls = 0;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(
  "**/api/integrations/nango/connection/check",
  async (route) => {
    calls++;
    return route.fulfill(
      fail
        ? {
            status: 503,
            json: { error: "Source check unavailable. Retry shortly." },
          }
        : { json: { checked: 1, results: [{ changed: true }] } },
    );
  },
);
await page.route(
  "**/api/knowledge-conflicts/conflict/replace",
  async (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill(
      fail
        ? {
            status: 409,
            json: { error: "Guidance changed. Reopen this review." },
          }
        : { json: { ok: true, knowledgeId: "new-knowledge" } },
    );
  },
);
const url = `http://127.0.0.1:${server.address().port}`;
try {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: "Refund approval limits" }),
    ).toBeVisible();
    await page
      .getByText("Compare previous and latest import", { exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Previous import", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${output}/phase-three-impact-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.goto(url + "?freshness");
    await page
      .getByRole("button", { name: "Check for updates", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "1 new revisions require review",
    );
    await page.screenshot({
      path: `${output}/phase-three-freshness-${width}.png`,
      fullPage: true,
    });
    fail = true;
    await page
      .getByRole("button", { name: "Check for updates", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Retry shortly");
    fail = false;
    await page.goto(url + "?conflict");
    await page.getByText("Create an updated rule", { exact: true }).click();
    await page.getByLabel("Rule title").fill("Refund limits");
    await page
      .getByLabel("Approved guidance")
      .fill(
        "Managers may approve up to $750. Above that requires owner approval.",
      );
    await page.getByRole("checkbox").check();
    await page.screenshot({
      path: `${output}/phase-three-conflict-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    fail = true;
    await page.getByRole("button", { name: "Approve updated rule" }).click();
    await expect(page.getByRole("alert")).toContainText("Guidance changed");
    fail = false;
    assert.equal(payload.expectedFirstVersion, 3);
    assert.equal(payload.expectedSecondVersion, 2);
    assert.equal(payload.reviewed, true);
    await page.getByRole("button", { name: "Approve updated rule" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Updated rule approved",
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url + "?freshness");
  await expect(
    page.getByRole("button", { name: "Check for updates", exact: true }),
  ).toBeVisible();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(calls, 4);
  console.log(
    "PASS: real Phase 3 views at 1440/390; import comparison, check/retry/status, explicit replacement/version payload, error recovery, success state, reduced motion, no overflow or browser errors. Fixture UI only.",
  );
  const video = page.video();
  await context.close();
  if (video)
    copyFileSync(await video.path(), `${output}/phase-three-fixture.webm`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
