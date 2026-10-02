// Actual React workspaces, isolated HTTP responses. Never calls production/model APIs.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const updated = "2026-09-16T12:00:00Z";
const knowledge = {
  id: "knowledge-1",
  entity: "knowledge",
  title: "Refund approval limits",
  content:
    "Managers may approve up to $500. Above $500 requires owner approval.",
  category: "policy",
  tags: ["Refunds"],
  revision: 1,
  status: "approved",
  source: "Confluence",
  source_title: "Refund Policy",
  source_url: "https://example.com/refunds",
  process_id: null,
  updated_at: updated,
  confirmed_at: updated,
  usage_count: 9,
  version: 3,
  review_required: false,
};
const proposal = {
  id: "proposal-1",
  type: "knowledge_proposal",
  kind: "approve",
  priority: "soon",
  title: "Refund escalation",
  summary: "Refunds above $500 require owner approval.",
  source: "Notion · Refund Policy",
  targetId: "proposal-1",
  targetUrl: "/app/needs-you?item=proposal-1",
  primaryAction: "accept",
  createdAt: updated,
  metadata: { version: 2, updatedAt: updated, knowledgeVersion: 3 },
};
const question = {
  id: "question-1",
  type: "question",
  kind: "answer",
  priority: "now",
  title: "Knowledge gap · Needs an answer",
  summary: "What if the shipment never arrived?",
  detail:
    "Asked 9 times across 2 channels. No approved answer covers this situation.",
  source: "Microsoft Teams",
  targetId: "question-1",
  targetUrl: "/app/needs-you?item=question-1",
  primaryAction: "answer",
  createdAt: updated,
};
const bundle = await build({
  stdin: {
    contents: `import React from'react';import{createRoot}from'react-dom/client';import{AskOpryn}from'./components/app/ask-opryn';import{KnowledgeLibrary}from'./components/app/knowledge-library';import{NeedsYouCenter}from'./components/app/needs-you-center';const k=${JSON.stringify(knowledge)};const view=new URLSearchParams(location.search).get('view')||'ask';createRoot(document.getElementById('root')).render(<main style={{maxWidth:1180,margin:'0 auto',padding:'32px 20px'}}>{view==='ask'?<><header style={{marginBottom:24}}><p className="product-kicker">Your company. One trusted answer.</p><h1 className="opryn-page-title">Ask Opryn</h1><p style={{marginTop:8,color:'#566279'}}>Ask a real work question. Get clear guidance, with the approved source attached.</p></header><AskOpryn hasKnowledge={!location.search.includes('empty')} prompts={[{category:'Approved process',text:'Can I approve a $300 refund?'},{category:'Approved policy',text:'What if the refund is $700?'}]} initialQuestion="" canTest/></>:view==='knowledge'?<KnowledgeLibrary items={location.search.includes('empty')?[]:[k,{...k,id:'knowledge-2',title:'Customer escalation',status:'needs_review',category:'customer_support',version:1}]} reviewItems={[]} usedItems={[]} total={location.search.includes('empty')?0:2} categories={{policy:1,customer_support:1}} sources={['Confluence']} filters={{view:'all'}} page={1} pageSize={20} canManage organizationName="Example workspace"/>:<NeedsYouCenter initialItems={location.search.includes('empty')?[]:[${JSON.stringify(question)},${JSON.stringify(proposal)}]} initialItemId={null} initialFilter={null}/>}</main>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  alias: { "@": process.cwd() },
  loader: { ".css": "empty" },
  plugins: [
    {
      name: "next-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: a.path.endsWith("navigation")
            ? 'const router={refresh(){window.fixtureRefreshes=(window.fixtureRefreshes||0)+1}};export const useRouter=()=>router;export const usePathname=()=>"/app/ask";export const useSearchParams=()=>new URLSearchParams();'
            : 'import React from"react";export default function Component({children,unoptimized,priority,...p}){return React.createElement("' +
              (a.path.endsWith("image") ? "img" : "a") +
              '",p,children)}',
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
    .join("\n") +
  "\n" +
  readFileSync("components/app/product-workspace.css", "utf8");
const server = createServer((req, res) => {
  res.setHeader(
    "content-type",
    req.url === "/fixture.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/fixture.js"
      ? bundle.outputFiles[0].text
      : `<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="opryn-app" style="background:#fffcf7"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const output = "artifacts/core-product-redesign";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  recordVideo: { dir: `${output}/motion`, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let answerMode = "answer",
  failRoute = true,
  failDecision = true,
  requests = 0,
  lastPayload;
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  let json = { ok: true };
  let status = 200;
  if (url.pathname === "/api/ask") {
    requests++;
    lastPayload = route.request().postDataJSON();
    await new Promise((r) => setTimeout(r, 350));
    if (answerMode === "error") {
      status = 503;
      json = { error: "The answer service is temporarily unavailable." };
    } else if (answerMode === "unknown") {
      json = {
        type: "unknown",
        questionId: "unknown-1",
        canEscalate: true,
        routed: false,
        expert: { name: "Operations Lead" },
      };
    } else {
      json = {
        type: "answer",
        questionId: "answered-1",
        headline: "Manager approval is enough",
        answer: "Yes. Managers may approve refunds up to $500.",
        steps: [
          "Confirm you are a manager.",
          "Check the amount is no more than $500.",
        ],
        importantNote: "Owner approval is required above $500.",
        sources: [
          {
            id: "knowledge-1",
            label: "Refund Policy → Refund approval limits",
            href: "/app/processes?knowledge=knowledge-1",
            content: knowledge.content,
          },
        ],
      };
    }
  } else if (url.pathname.endsWith("/escalate") && failRoute) {
    status = 503;
    json = { error: "Not sent" };
  } else if (
    url.pathname.includes("knowledge-proposals") &&
    url.pathname.endsWith("/approve") &&
    failDecision
  ) {
    status = 409;
    json = { error: "Proposal changed. Review the latest version." };
  } else if (url.pathname.endsWith("/manage")) {
    json = {
      clarifications: [],
      people: [],
      canManage: true,
      assignedExpertId: null,
    };
  } else if (url.pathname === "/api/knowledge-scope") {
    json = {
      scope: { regions: ["US"] },
      canManage: true,
      version: 3,
      revision: 1,
      updatedAt: updated,
    };
  }
  await route.fulfill({ status, json });
});
async function shot(name) {
  const surface = page.locator(
    "dialog[open] > .dialog-content, dialog[open] > .needs-you-sheet",
  );
  if (await surface.count()) await expect(surface).toHaveCSS("opacity", "1");
  if (await surface.count())
    await surface.evaluate(async (element) => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter((animation) =>
            Number.isFinite(animation.effect?.getComputedTiming().endTime),
          )
          .map((animation) => animation.finished.catch(() => {})),
      );
    });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await surface.count()),
  });
}
async function noOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
}
try {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["ask", "knowledge", "needs"]) {
      await page.goto(`${base}/?view=${view}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow();
      await shot(`${view}-${width}`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/?view=ask`);
  await page
    .getByLabel("Your company question")
    .fill("Can I approve a $300 refund?");
  await page.getByRole("button", { name: "Ask Opryn", exact: true }).click();
  await expect(
    page.getByText("Searching approved knowledge…", { exact: true }),
  ).toBeVisible();
  await shot("ask-working");
  await expect(
    page.getByRole("heading", { name: "Manager approval is enough" }),
  ).toBeVisible();
  await expect(
    page.getByText("Searching approved knowledge…", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show details" }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Confirm you are a manager." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy answer" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await page.getByRole("button", { name: "Ask a follow-up" }).click();
  await expect(page.getByLabel("Your company question")).toBeFocused();
  await shot("ask-answer-desktop");
  await page.getByRole("button", { name: "Not right", exact: true }).click();
  await expect(
    page.getByText("What was wrong?", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Outdated", exact: true }).click();
  await expect(
    page.getByText("Sent for review.", { exact: true }),
  ).toBeVisible();
  assert.equal(requests, 1);
  assert.equal(lastPayload.question, "Can I approve a $300 refund?");
  answerMode = "unknown";
  await page
    .getByLabel("Your company question")
    .fill("What if the shipment never arrived?");
  await page.getByRole("button", { name: "Ask Opryn", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Opryn doesn't have an approved answer yet.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask Operations Lead" }).click();
  await expect(
    page.getByText("The question wasn't sent. Try again."),
  ).toBeVisible();
  failRoute = false;
  await page.getByRole("button", { name: "Ask Operations Lead" }).click();
  await expect(
    page.getByRole("button", { name: "Sent to Operations Lead" }),
  ).toBeDisabled();
  await shot("ask-gap");
  answerMode = "error";
  await page.getByLabel("Your company question").fill("Retry this question");
  await page.getByRole("button", { name: "Ask Opryn", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByLabel("Your company question")).toHaveValue(
    "Retry this question",
  );
  await page.goto(`${base}/?view=knowledge`);
  await page
    .getByRole("button", {
      name: "Open Refund approval limits, Approved, version 3",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Refund approval limits" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tags")).not.toBeVisible();
  await page.getByText("Organize this knowledge", { exact: true }).click();
  await expect(page.getByLabel("Tags")).toBeVisible();
  await shot("knowledge-detail-desktop");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Open Refund approval limits, Approved, version 3",
    }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Filter company knowledge" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`${base}/?view=needs`);
  for (const name of ["Approve", "Conflicts", "Updates", "Answer", "All"])
    await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Review What if the shipment never arrived?",
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Proposal changed");
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeEnabled();
  failDecision = false;
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    page.getByText("Opryn knows this now.", { exact: true }),
  ).toBeVisible();
  await shot("needs-resolution");
  await page.getByRole("button", { name: /Clear completed decisions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing in this view." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  answerMode = "answer";
  await page.goto(`${base}/?view=ask`);
  await page
    .getByLabel("Your company question")
    .fill("Can I approve a $300 refund?");
  await page.getByRole("button", { name: "Ask Opryn", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Manager approval is enough" }),
  ).toBeVisible();
  await noOverflow();
  await shot("ask-answer-mobile");
  await page.goto(`${base}/?view=knowledge`);
  await page
    .getByRole("button", {
      name: "Open Refund approval limits, Approved, version 3",
    })
    .click();
  await noOverflow();
  await shot("knowledge-detail-mobile");
  await page.keyboard.press("Escape");
  await page.goto(`${base}/?view=needs`);
  await page.getByRole("button", { name: "Take a look" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow();
  await shot("needs-detail-mobile");
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const view of ["ask", "knowledge", "needs"]) {
    await page.goto(`${base}/?view=${view}&empty=1`);
    await noOverflow();
    await shot(`${view}-empty-reduced`);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real React workspaces at 1440/768/390, sourced answers/orb, copy/follow-up, unknown escalation failure/retry, answer failure/input preservation, filters/detail focus/Escape, guarded decision failure/success/receipt/list removal, mobile sheets, empty/reduced motion, zero runtime errors. Isolated fixtures, not authenticated backend E2E.",
  );
} finally {
  await context.close();
  await browser.close();
  await new Promise((r) => server.close(r));
}
