// Real Home React components; isolated API doubles. Never mutates a live workspace.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const items = [
  {
    id: "proposal-1",
    type: "knowledge_proposal",
    kind: "approve",
    priority: "soon",
    title: "Website revision policy",
    summary:
      "Two revision rounds are included. Additional rounds require project-lead approval.",
    detail: "Review this proposed guidance before making it official.",
    source: "Google Docs · Client policies",
    targetId: "proposal-1",
    targetUrl: "/app/needs-you?item=proposal-1",
    primaryAction: "accept",
    createdAt: "2026-09-18T10:00:00Z",
    metadata: {
      version: 2,
      updatedAt: "2026-09-18T10:00:00Z",
      knowledgeVersion: 3,
    },
  },
  {
    id: "question-1",
    type: "question",
    kind: "answer",
    priority: "now",
    title: "Knowledge gap · Needs an answer",
    summary: "What if the customer has paid for the extra revision?",
    detail: "Asked 4 times across 2 channels. No approved answer covers this.",
    source: "Slack",
    targetId: "question-1",
    targetUrl: "/app/needs-you?item=question-1",
    primaryAction: "answer",
    createdAt: "2026-09-18T10:00:00Z",
  },
  {
    id: "conflict-1",
    type: "conflict",
    kind: "conflict",
    priority: "now",
    title: "Conflicting refund limits",
    summary: "Two sources disagree about refund approval limits.",
    detail: "A human needs to decide which guidance applies.",
    source: "Notion / Confluence",
    targetId: "conflict-1",
    targetUrl: "/app/needs-you?item=conflict-1",
    primaryAction: "resolve",
    createdAt: "2026-09-18T10:00:00Z",
  },
];
const bundle = await build({
  stdin: {
    contents: `import React from'react';import{createRoot}from'react-dom/client';import{OwnerHome}from'./components/app/owner-home';const empty=location.search.includes('empty');createRoot(document.getElementById('root')).render(<main style={{maxWidth:1240,margin:'auto',padding:'28px 24px'}}><OwnerHome name="Jordan" organizationName="Example workspace" handledCount={12} gapCount={1} hasApprovedKnowledge={false} items={empty?[]:${JSON.stringify(items)}} teach={empty?null:{title:'Rush fees',reason:'Asked 6 times this month. No approved answer covers this yet.',href:'/app/processes/new?prompt=Rush%20fees',action:'Teach Opryn'}} handled={empty?[]:[{id:'handled-1',question:'How many revisions are included?',origin:'slack',created_at:'2026-09-18T10:00:00Z'}]} recentKnowledge={[]} health={<section className="home-health-summary"><p className="owner-eyebrow">The guidance behind the answers</p><h2>Knowledge health</h2><dl className="home-health-counts">{[['Approved entries',48],['Findings to review',2],['Open conflicts',1],['Potentially outdated',3]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><a className="home-health-link" href="/app/knowledge/health">View knowledge health →</a></section>} intelligence={<p>Recorded activity only. No arbitrary health score.</p>}/></main>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  outfile: "fixture.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "next-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: a.path.endsWith("navigation")
            ? "export const useRouter=()=>({refresh(){window.refreshes=(window.refreshes||0)+1}});"
            : 'import React from"react";export default function Link({children,...props}){return React.createElement("a",props,children)}',
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  if (
    /^\/opryn-icons\/[a-f0-9-]+\.png$/.test(req.url ?? "") &&
    existsSync(`public${req.url}`)
  ) {
    res.setHeader("content-type", "image/png");
    res.end(readFileSync(`public${req.url}`));
    return;
  }
  if (req.url === "/fixture.js") {
    res.setHeader("content-type", "application/javascript");
    res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fffcf7;color:#14213d;font-family:Arial}*{box-sizing:border-box}a{color:inherit;text-decoration:none}button{font:inherit;border:0;background:transparent;color:inherit}p,h1,h2,h3,dl,dd{margin:0}svg{vertical-align:middle}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}${bundle.outputFiles.find((f) => f.path.endsWith(".css")).text}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const directory = "artifacts/owner-home";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
let assertions = 0;
try {
  for (const width of [390, 768, 1440])
    for (const reduced of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height: 960 },
        reducedMotion: reduced ? "reduce" : "no-preference",
        recordVideo:
          width === 1440 && !reduced
            ? { dir: `${directory}/recordings` }
            : undefined,
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let failure = true,
        calls = 0;
      await page.route("**/api/knowledge-proposals/**", async (route) => {
        calls++;
        assert.deepEqual(route.request().postDataJSON(), {
          version: 2,
          updatedAt: "2026-09-18T10:00:00Z",
          knowledgeVersion: 3,
        });
        await new Promise((r) => setTimeout(r, 350));
        await route.fulfill({
          status: failure ? 503 : 200,
          json: failure
            ? { error: "Approval was not saved. Try again." }
            : { ok: true },
        });
      });
      await page.goto(base);
      await page.waitForTimeout(650);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator(".owner-decision")).toHaveCount(3);
      await expect(page.locator(".owner-summary")).toContainText(
        "12 handled this week",
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assertions += 4;
      await page.screenshot({
        path: `${directory}/home-${width}${reduced ? "-reduced" : ""}.png`,
        fullPage: true,
      });
      const row = page.locator('[data-decision-id="proposal-1"]');
      const trigger = row.getByRole("button", { name: /Ready to approve/ });
      await trigger.focus();
      if (!reduced) await trigger.hover();
      await page.screenshot({ path: `${directory}/hover-${width}.png` });
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(
        row.getByText("Two revision rounds are included.", { exact: false }),
      ).toBeVisible();
      await page.screenshot({ path: `${directory}/expanded-${width}.png` });
      await row.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(
        row.getByRole("button", { name: "Approving…", exact: true }),
      ).toBeDisabled();
      await expect(
        row.getByRole("button", { name: "Approved", exact: true }),
      ).toHaveCount(0);
      await page.screenshot({ path: `${directory}/pending-${width}.png` });
      await expect(row.getByRole("alert")).toContainText("not saved");
      await expect(row).toBeVisible();
      assertions += 5;
      failure = false;
      await row
        .getByRole("button", { name: "Approve", exact: true })
        .evaluate((e) => {
          e.click();
          e.click();
        });
      await expect(
        row.getByRole("button", { name: "Approved", exact: true }),
      ).toBeVisible();
      assert.equal(calls, 2);
      await page.screenshot({ path: `${directory}/success-${width}.png` });
      await expect(row).toHaveCount(0);
      await expect(page.locator(".owner-decision")).toHaveCount(2);
      await expect(page.locator(".owner-recent-knowledge")).toContainText(
        "Website revision policy",
      );
      await expect(
        page.getByText("Your first knowledge is live.", { exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: `${directory}/settled-${width}.png` });
      assertions += 5;
      await page
        .locator('[data-decision-id="conflict-1"]')
        .getByRole("button")
        .click();
      await expect(
        page.getByRole("link", { name: "Open full review", exact: false }),
      ).toHaveAttribute("href", "/app/needs-you?item=conflict-1");
      await expect(
        page.getByRole("button", { name: "Approve", exact: true }),
      ).toHaveCount(0);
      assertions += 2;
      await page.goto(`${base}?empty`);
      await expect(
        page.getByText("You’re caught up.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("No teaching recommendation is available right now.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Your first answer starts here.", { exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${directory}/empty-${width}${reduced ? "-reduced" : ""}.png`,
        fullPage: true,
      });
      assert.deepEqual(errors, []);
      assertions += 4;
      await context.close();
    }
  console.log(
    `PASS: ${assertions} real Home browser assertions; screenshots and approval recording in ${directory}. API fixtures, not production writes.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
