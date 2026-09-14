import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";

// Render the real server page against explicit fixtures. This checks responsive
// composition, not live OAuth, database wiring, or approval button mutations.
const require = createRequire(import.meta.url);
const load = (path, dependencies = {}) => {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    { exports, require: (name) => dependencies[name] ?? require(name), Date },
  );
  return exports;
};
const id = "00000000-0000-4000-8000-000000000001";
const sample = {
  id,
  title: "Refund approval limits",
  content:
    "Managers approve refunds up to $500. Higher refunds require owner approval.",
  reason: "Not confirmed in 90 days",
  current_version: 2,
  criticality: "critical",
  last_confirmed_at: "2026-01-02",
  usage_count: 12,
};
let fixture = {
  limited: false,
  approvedCount: 4,
  areas: [
    {
      id,
      title: "Customer Support",
      approved: 4,
      conflicts: 1,
      reviews: 1,
      usage: 12,
      href: "/app/processes",
    },
  ],
  freshness: [sample],
  conflicts: [{ id, explanation: "Two refund limits disagree." }],
  keyPersonRisks: [{ title: "Vendor Purchasing", name: "Mike" }],
  gaps: [
    {
      ...sample,
      topic: "Deposit refunds",
      representative_question: "Are deposits refundable?",
      questions: 8,
      unresolved: 3,
      escalations: 2,
      people: 3,
      channels: { slack: 3, mcp_claude: 5 },
      estimatedMinutes: 6,
    },
  ],
  mostUsed: [sample],
  recent: { asked: 10, answered: 7, escalated: 2 },
  interruptionMinutes: 3,
};
const HealthPage = load("../app/app/knowledge/health/page.tsx", {
  "next/link": ({ children, ...props }) =>
    React.createElement("a", props, children),
  "@/lib/app-context": {
    requireAdminContext: async () => ({ organization: { id } }),
  },
  "@/lib/supabase/server": { createClient: async () => ({}) },
  "@/lib/opryn/knowledge/health": { getKnowledgeHealth: async () => fixture },
  "@/components/app/page-heading": load("../components/app/page-heading.tsx"),
  "@/components/app/learning-inbox-actions": {
    InboxAction: ({ children }) =>
      React.createElement(
        "button",
        { className: "min-h-11 rounded-xl bg-[#3158d8] px-4 text-white" },
        children,
      ),
  },
}).default;
const cssDirectory = new URL("../.next/static/css/", import.meta.url);
const css = readdirSync(cssDirectory)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(new URL(name, cssDirectory), "utf8"))
  .join("\n");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const markup = renderToStaticMarkup(await HealthPage());
  for (const width of [320, 375, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body style="margin:0"><main style="padding:20px;max-width:1100px;margin:auto">${markup}</main></body></html>`,
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Knowledge Health", exact: true })
        .count(),
      1,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `No horizontal overflow at ${width}px`,
    );
    const firstHeading = await page
      .getByRole("heading", { name: "Knowledge Health", exact: true })
      .boundingBox();
    assert.ok(firstHeading.y < 180, "Title begins near the top on phones");
    await page.getByRole("link", { name: "Freshness", exact: true }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "Still Accurate", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page
        .locator(".memory-section")
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    if (width === 390 && process.env.OPRYN_UI_SCREENSHOT)
      await page.screenshot({
        path: process.env.OPRYN_UI_SCREENSHOT,
        fullPage: true,
      });
  }
  fixture = {
    ...fixture,
    approvedCount: 0,
    areas: [],
    freshness: [],
    conflicts: [],
    keyPersonRisks: [],
    gaps: [],
    mostUsed: [],
    recent: { asked: 0, answered: 0, escalated: 0 },
  };
  await page.setContent(renderToStaticMarkup(await HealthPage()));
  assert.equal(
    await page
      .getByRole("link", { name: "Start Learning", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByText("0 approved knowledge entries.", { exact: true })
      .count(),
    0,
  );
  console.log(
    "Passed real Health page fixture rendering at 320/375/390/430/1280px, section links, reduced motion, and zero-knowledge state.",
  );
} finally {
  await browser.close();
}
