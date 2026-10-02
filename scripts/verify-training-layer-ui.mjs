// Actual React components, deterministic API fixtures. No live workspace or model calls.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
const k = {
  id: "knowledge-1",
  content: "Refunds over $500 require manager approval.",
  current_version: 1,
  source_type: "rule",
  process_id: null,
  library_category: "policy",
  approved: true,
  health_status: "healthy",
  library_archived_at: null,
  scope: {},
  role_id: null,
};
const a = {
  id: "assignment-1",
  user_id: "employee-1",
  knowledge_chunk_id: k.id,
  required_version: 1,
  acknowledged_version: null,
  passed_version: null,
  update_required: false,
  previous_version: null,
  started_at: null,
  retired_at: null,
};
const s = {
  id: "scenario-1",
  knowledge_chunk_id: k.id,
  knowledge_version: 1,
  format: "scenario",
  prompt: "A customer requests a $750 refund. What should you do?",
  supporting_quote: k.content,
  status: "approved",
  revision: 1,
};
const agent = {
  id: "agent-1",
  name: "Support Agent",
  description: "Answer customer support questions.",
  provider: "custom",
  status: "active",
  knowledge_policy: {
    mode: "subjects",
    subjects: ["customer_support", "policy"],
    excludedSubjects: ["pricing"],
  },
  unknown_behavior: "route_expert",
  configuration_version: 1,
  behavior_rules:
    "Never invent policy. Escalate if approved knowledge is unavailable.",
};
const tests = [
  {
    id: "test-1",
    title: "Refund after 45 days",
    connection_id: agent.id,
    question: "Can I refund an order after 45 days?",
    expected_behavior: "Escalate when approved guidance is missing.",
    needs_rerun: false,
    last_run_at: null,
    last_result: {
      trainingStatus: "knowledge_gap",
      type: "unknown",
      explanation:
        "No approved guidance was retrieved under this connection’s permissions.",
      sources: [],
    },
  },
];
const bundle = await build({
  stdin: {
    contents: `import React,{useState} from'react';import{createRoot}from'react-dom/client';import{EmployeeLearning,TrainingConfiguration}from'./components/training/people-training';import{AgentTraining}from'./components/training/agent-training';const params=new URLSearchParams(location.search);let k=${JSON.stringify(k)},a=${JSON.stringify(a)},s=${JSON.stringify(s)};if(params.has('update')){k={...k,content:'Refunds over $750 require manager approval.',current_version:2};a={...a,required_version:2,previous_version:1,update_required:true};s={...s,knowledge_version:2,prompt:'A customer requests a $1000 refund. What should you do?'}}createRoot(document.getElementById('root')).render(<main className="training-workspace" style={{padding:24}}><header className="training-header"><p className="training-eyebrow">Acme · Test workspace</p><h1>Keep your company trained.</h1><p>One approved knowledge layer for your people and agents.</p></header><nav className="training-tabs" aria-label="Training"><a href="/">People</a><a href="/?agents">Agents</a><a href="/?config">Role knowledge</a></nav>{params.has('agents')?<AgentTraining agents={[${JSON.stringify(agent)}]} tests={${JSON.stringify(tests)}}/>:params.has('config')?<TrainingConfiguration knowledge={[k]} roles={[{id:'role-1',name:'Support Rep'}]}/>:<EmployeeLearning assignments={[a]} knowledge={[k]} scenarios={[s]} previous={params.has('update')?{'knowledge-1':${JSON.stringify(k.content)}}:{}}/>}</main>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  format: "iife",
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
            : 'import React from"react";export default function Link(p){return React.createElement("a",p,p.children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css =
  readdirSync(".next/static/css")
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(`.next/static/css/${f}`, "utf8"))
    .join("\n") + readFileSync("components/training/training.css", "utf8");
const server = createServer((req, res) => {
  res.setHeader(
    "Content-Type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? bundle.outputFiles[0].text
      : `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Training verification</title><style>${css}</style></head><body style="background:#f7f9fc"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
const output = "artifacts/training-layer";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  recordVideo: {
    dir: `${output}/recordings`,
    size: { width: 1280, height: 900 },
  },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let payload,
  fail = false;
await page.route("**/api/training/**", async (route) => {
  payload = route.request().postDataJSON();
  const practice = route.request().url().endsWith("/practice");
  await route.fulfill({
    status: fail ? 409 : 200,
    contentType: "application/json",
    body: JSON.stringify(
      fail
        ? { error: "Guidance changed during practice. Refresh and try again." }
        : practice
          ? {
              outcome:
                payload.action === "practice" ? "supported" : "acknowledged",
              feedback:
                payload.action === "practice"
                  ? {
                      feedback: "Manager approval is required for this refund.",
                    }
                  : null,
            }
          : {
              assigned: 1,
              message: "Evaluation queued. The background worker will run it.",
              routed: true,
            },
    ),
  });
});
try {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url);
    await expect(
      page.getByRole("heading", {
        name: "Refunds over $500 require manager approval.",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "I understand this guidance" })
      .click();
    assert.equal(payload.version, 1);
    await expect(page.getByRole("status")).toContainText(
      "Current guidance acknowledged",
    );
    await page
      .getByText("Practice applying this guidance", { exact: true })
      .click();
    await page
      .getByLabel("Your response", { exact: true })
      .fill("Manager approval is required before refunding $750.");
    await page.getByRole("button", { name: "Check my response" }).click();
    await expect(
      page.getByText("Manager approval is required for this refund.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: `${output}/people-${width}.png`,
      fullPage: true,
    });
    fail = true;
    await page.getByRole("button", { name: "Check my response" }).click();
    await expect(page.getByRole("status")).toContainText("Guidance changed");
    fail = false;
    await page.goto(url + "/?update");
    await expect(page.getByText("What changed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Refunds over $500 require manager approval.", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Got it — acknowledge update" })
      .click();
    assert.equal(payload.version, 2);
    await page.screenshot({
      path: `${output}/update-${width}.png`,
      fullPage: true,
    });
    await page.goto(url + "/?agents");
    await page.getByText("Support Agent", { exact: true }).click();
    await expect(
      page.getByText("Knowledge gap", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ask the right person" }).click();
    assert.equal(payload.action, "route_gap");
    await page.getByRole("button", { name: "Queue evaluation" }).click();
    assert.equal(payload.action, "queue");
    await page.screenshot({
      path: `${output}/agents-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "mobile overflow",
    );
    await page.goto(url + "/?config");
    await page.getByText("Assign role knowledge", { exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Apply requirements" }).click();
    assert.deepEqual(payload.knowledgeIds, [k.id]);
    await page
      .getByText("Review practice for approved knowledge", { exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Approved knowledge", exact: true })
      .selectOption(k.id);
    await page
      .getByRole("button", { name: "Suggest grounded practice" })
      .click();
    await expect(
      page.getByLabel("Practice situation / question"),
    ).toContainText("$750");
    await page.getByRole("button", { name: "Approve practice" }).click();
    assert.equal(payload.supportingQuote, k.content);
    await page.screenshot({
      path: `${output}/role-map-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await page.keyboard.press("Tab");
  assert.ok(await page.locator(":focus").count());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual training React UI at 1440/768/390; acknowledgement, practical response, stale-version error, change comparison, gap routing, queue payloads, explicit role assignment, grounded draft review, keyboard focus, reduced motion, no page errors or mobile overflow. API fixtures; not live authenticated E2E.",
  );
} finally {
  await context.close();
  await page.video()?.saveAs(`${output}/training-walkthrough.webm`);
  await browser.close();
  await new Promise((r) => server.close(r));
}
