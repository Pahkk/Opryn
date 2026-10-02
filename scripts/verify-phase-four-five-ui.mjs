// Real React components with isolated request fixtures, NOT authenticated/provider E2E.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const version = "2026-09-16T12:00:00.000Z";
const processFixture = {
  id: id(1),
  title: "Refund approval limits",
  summary:
    "Managers may approve up to $500. Above $500 requires owner approval.",
  updated_at: version,
  library_category: "policy",
};
const sources = [
  {
    id: id(2),
    title: "Refund Policy",
    provider: "confluence",
    connectionStatus: "connected",
  },
  {
    id: id(3),
    title: "Pricing",
    provider: "notion",
    connectionStatus: "connected",
  },
  {
    id: id(4),
    title: "Operations",
    provider: "google_workspace",
    connectionStatus: "disconnected",
  },
];
const result = {
  sources: [{ ...sources[0], status: "prepared", processId: id(1) }],
  snapshot: {
    approvedItems: 12,
    approvedProcesses: 8,
    approvedPolicies: 9,
    approvedFAQs: 3,
    conflicts: 1,
    openGaps: 7,
    sourceIssues: 1,
    keyPersonDependencies: 1,
    readyForReview: 1,
    draftRuleCandidates: 2,
    limited: false,
  },
};
const intelligence = {
  handledTeam: 21,
  handledAI: 4,
  escalated: 5,
  openGaps: 7,
  resolvedGaps: 2,
  humanKnowledge: 1,
  estimatedMinutes: 48,
  eligibleQuestions: 16,
  minutesPerQuestion: 3,
  periodDays: 30,
  aiLogsLimitedByRetention: false,
  recommendation: null,
  topGap: null,
  keyPersonDependencies: [
    { id: id(5), topic: "Vendor purchasing", questions: 9 },
  ],
};
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{AIAccessPolicy}from'./components/app/ai-access-policy';import{MyLearning,RoleLearningAssignment}from'./components/app/learning-workspace';import{OwnerIntelligencePanel}from'./components/app/owner-intelligence';import{CompanyAnalysis}from'./components/app/company-analysis';const p=${JSON.stringify(processFixture)};const q=new URLSearchParams(location.search);createRoot(document.getElementById('root')).render(<main style={{maxWidth:1050,margin:'auto',padding:24}}>{q.has('learning')?<><MyLearning processes={[p]} assignments={[{process_id:p.id,learning_state:'not_started',acknowledged_process_updated_at:null,practiced_process_updated_at:null}]}/><RoleLearningAssignment roles={[{id:'${id(6)}',name:'Support'}]} processes={[p]} requirements={[]}/></>:q.has('analysis')?<CompanyAnalysis sources={${JSON.stringify(sources)}} initialRun={null} limited={false}/>:q.has('owner')?<OwnerIntelligencePanel data={${JSON.stringify(intelligence)}}/>:<AIAccessPolicy connection={{id:'${id(7)}',updated_at:'${version}',knowledge_policy:{mode:'inherit'},unknown_behavior:'route_expert',activity_retention_days:90}} knowledge={[{id:p.id,content:p.summary,library_category:'policy',current_version:3}]} limited={false}/>}</main>);`,
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
            ? "const router={refresh(){window.fixtureRefreshes=(window.fixtureRefreshes||0)+1}};export const useRouter=()=>router"
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
    dir: `${output}/phase-four-five-video`,
    size: { width: 1440, height: 900 },
  },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let fail = false,
  payload;
await page.route("**/api/ai-connections/*/policy", (route) => {
  payload = route.request().postDataJSON();
  return route.fulfill(
    fail
      ? {
          status: 409,
          json: { error: "Policy changed. Reopen this connection." },
        }
      : { json: { ok: true, updatedAt: version } },
  );
});
await page.route("**/api/learning/activity", (route) => {
  payload = route.request().postDataJSON();
  return route.fulfill({
    json: {
      ok: true,
      feedback:
        payload.action === "practiced"
          ? {
              result: "supported",
              feedback: "Owner approval is required above $500.",
              supportingQuote: "Above $500 requires owner approval.",
            }
          : undefined,
    },
  });
});
await page.route("**/api/company-analysis", (route) => {
  payload = route.request().postDataJSON();
  return route.fulfill(
    fail
      ? {
          status: 503,
          json: {
            error:
              "Analysis interrupted. Prepared findings remain in Needs You.",
          },
        }
      : { json: { run: { id: id(8), status: "complete", result } } },
  );
});
const url = `http://127.0.0.1:${server.address().port}`;
try {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await page.getByRole("combobox").first().selectOption("items");
    await page.getByRole("checkbox").first().check();
    await page.screenshot({
      path: `${output}/phase-four-ai-policy-${width}.png`,
      fullPage: true,
    });
    fail = true;
    await page.getByRole("button", { name: "Save AI access" }).click();
    await expect(page.getByRole("status")).toContainText("Policy changed");
    assert.equal(payload.expectedUpdatedAt, version);
    assert.deepEqual(payload.policy.knowledgeIds, [id(1)]);
    fail = false;
    await page.goto(url + "?learning");
    await page
      .getByRole("button", { name: "Acknowledge this version" })
      .click();
    await expect(page.getByText("Acknowledged", { exact: true })).toBeVisible();
    assert.equal(payload.expectedUpdatedAt, version);
    await page
      .getByText("Practice applying this guidance", { exact: true })
      .click();
    await page
      .getByLabel("Your response")
      .fill("I ask the owner for approval above $500.");
    await page.getByRole("button", { name: "Compare with guidance" }).click();
    await expect(
      page.getByText("Owner approval is required above $500.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${output}/phase-four-learning-${width}.png`,
      fullPage: true,
    });
    await page.goto(url + "?analysis");
    await expect(page.getByRole("checkbox").last()).toBeDisabled();
    await page.getByRole("checkbox").first().check();
    fail = true;
    await page
      .getByRole("button", { name: "Analyze my company knowledge" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Analysis interrupted",
    );
    fail = false;
    await page
      .getByRole("button", { name: "Analyze my company knowledge" })
      .click();
    await expect(
      page.getByRole("heading", { name: "What Opryn found" }),
    ).toBeVisible();
    assert.deepEqual(payload.sourceIds, [id(2)]);
    await page.screenshot({
      path: `${output}/phase-five-analysis-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.goto(url + "?owner");
    await page.getByText("How these numbers work").click();
    await page.screenshot({
      path: `${output}/phase-five-home-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url + "?learning");
  await expect(
    page.getByRole("heading", { name: "Refund approval limits" }),
  ).toBeVisible();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual Phase 4/5 React UI, 1440/768/390, policy payload/stale recovery, versioned acknowledgement/practice, disconnected-source selection, analysis error/retry, owner metrics, reduced motion and no page errors/overflow. Isolated HTTP requests, not authenticated Supabase E2E.",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((r) => server.close(r));
}
