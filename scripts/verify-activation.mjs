import assert from "node:assert/strict";
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, webkit, expect } from "@playwright/test";
const root = process.cwd();
const bundle = await build({
  entryPoints: ["scripts/activation-ui-fixture.jsx"],
  bundle: true,
  write: false,
  outfile: "activation.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": root },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.invalid"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '"test-only"',
  },
  plugins: [
    {
      name: "next-fixture",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "jsx",
          contents: a.path.endsWith("navigation")
            ? `export const useRouter=()=>({push:(url)=>location.assign(url),replace:(url)=>location.assign(url),refresh:()=>{}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`
            : a.path.endsWith("link")
              ? `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`
              : `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined}/>} `,
          resolveDir: root,
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
  bundle.outputFiles
    .filter((f) => f.path.endsWith(".css"))
    .map((f) => f.text)
    .join("\n");
const server = createServer((req, res) => {
  const name = new URL(req.url, "http://localhost").pathname;
  if (name === "/activation.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  const asset = path.resolve("public", `.${name}`);
  if (
    asset.startsWith(path.resolve("public") + path.sep) &&
    existsSync(asset) &&
    /\.(png|svg|webp)$/.test(asset)
  ) {
    res.setHeader(
      "Content-Type",
      asset.endsWith("svg") ? "image/svg+xml" : "image/png",
    );
    return res.end(readFileSync(asset));
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/activation.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`,
  org = "10000000-0000-4000-8000-000000000001",
  id = "20000000-0000-4000-8000-000000000001";
mkdirSync("artifacts/activation", { recursive: true });
try {
  for (const [engine, width, reduced] of [
    [chromium, 1440, false],
    [chromium, 390, false],
    [chromium, 360, true],
    [webkit, 430, true],
  ]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage({
        viewport: { width, height: 940 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      let saved = false,
        source = false,
        approved = false,
        activated = false,
        billingVerified = false;
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const company = {
        name: "Example Studio",
        description: "Website design and support",
        industry: "Services",
        employee_count: 3,
        website: "",
        departments: "",
        knowledge_areas: ["Policies"],
        notes: "",
      };
      const review = () => ({
        id,
        title: "Refund approval limits",
        summary:
          "Managers may approve refunds up to $500. Larger refunds need owner approval.",
        purpose: "Consistent refund decisions",
        status: approved ? "approved" : "needs_review",
        source: "Refund Policy · Google Docs",
        criticality: "normal",
        roleId: null,
        expertId: null,
        steps: [
          {
            title: "Check the amount",
            description: "Ask the owner when it exceeds $500.",
          },
        ],
        rules: [
          {
            title: "Approval limits",
            text: "Up to $500: manager. Above $500: owner.",
          },
        ],
        exceptions: [],
        clarifications: [],
      });
      await page.route("**/api/**", async (route) => {
        const p = new URL(route.request().url()).pathname,
          body = route.request().postDataJSON();
        let data = {};
        if (p === "/api/onboarding") data = { organizationId: org };
        else if (p === "/api/onboarding/activation") {
          if (body?.action === "company") saved = true;
          if (body?.action === "source") source = true;
          if (body?.action === "finish") {
            assert.ok(body.questionId);
            activated = true;
            data = { saved: true };
          } else
            data = body
              ? { saved: true, revision: 2 }
              : {
                  organizationId: org,
                  company,
                  revision: 1,
                  onboarding: {
                    current_step: saved ? "teach" : "setup",
                    selected_goals: ["answer_questions"],
                    first_test_answered: activated,
                  },
                  sources: source
                    ? [
                        {
                          id,
                          title: "Refund Policy",
                          status: approved ? "approved" : "needs_review",
                        },
                      ]
                    : [],
                  review: source ? review() : null,
                  answered: approved,
                };
        } else if (p === "/api/onboarding/suggestions") {
          data = {
            suggestion: {
              description: "We design websites and support customer projects.",
              industryId: "technology",
              explanation: "Suggested because you mentioned website design.",
              departments: ["Design", "Support"],
              knowledgeAreas: ["Policies", "Processes"],
              firstSource: "explain",
              sourceReason: "Start with one rule you can explain.",
              firstQuestion: "Who can approve refunds?",
            },
          };
        } else if (p === "/api/billing/options") {
          data = {
            plans: [
              {
                plan: "core",
                interval: "month",
                name: "Opryn Core",
                amount: 9900,
                currency: "usd",
                teamLimit: 5,
              },
              {
                plan: "premium",
                interval: "month",
                name: "Opryn Premium",
                amount: 24900,
                currency: "usd",
                teamLimit: 20,
              },
            ],
            trial: {
              plan: "premium",
              interval: "month",
              days: 5,
              requiresPaymentMethod: true,
              eligible: true,
            },
            status: "not_subscribed",
          };
        } else if (p === "/api/billing/status") {
          data = {
            verified: billingVerified,
            status: billingVerified ? "trialing" : "not_subscribed",
            trialEnd: billingVerified ? "2026-09-20T00:00:00Z" : null,
          };
        } else if (p === "/api/billing/checkout") {
          assert.equal(body.intent, "trial");
          assert.equal(body.source, "onboarding");
          return route.fulfill({
            status: 503,
            json: {
              error: "Test checkout unavailable. Your workspace is saved.",
            },
          });
        } else if (p === "/api/processes") {
          source = true;
          data = { processId: id, ready: true };
        } else if (p.endsWith("/approve")) {
          approved = true;
          data = { ok: true };
        } else if (p === "/api/ask")
          data = {
            type: "answer",
            questionId: id,
            answer:
              "Managers may approve up to $500. Above $500 requires owner approval.",
            sources: [{ label: "Refund Policy", href: `/app/processes/${id}` }],
          };
        else if (p === "/api/integrations/capability")
          data = { connectionId: null };
        await route.fulfill({ json: data });
      });
      const shot = async (name) => {
        await expect(page.locator("[data-motion-region]").first()).toHaveCSS(
          "opacity",
          "1",
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          `${name}: overflow ${width}`,
        );
        await page.screenshot({
          path: `artifacts/activation/${name}-${width}.png`,
          fullPage: true,
        });
      };
      await page.goto(origin + "/onboarding");
      await expect(
        page.getByRole("heading", {
          name: "Let’s set up Opryn around your business.",
        }),
      ).toBeVisible();
      await shot("goal");
      await page
        .getByRole("button", { name: "Continue →", exact: true })
        .click();
      await page.getByLabel("Company name", { exact: true }).fill(company.name);
      await page
        .getByRole("combobox", { name: "Industry" })
        .fill("apps for businesses");
      await page.getByRole("combobox", { name: "Industry" }).press("Enter");
      await page
        .getByLabel("What does your company do?")
        .fill(company.description);
      await page.getByRole("button", { name: "Help me set this up →" }).click();
      await expect(
        page.getByRole("button", { name: "Use these suggestions" }),
      ).toBeVisible();
      await expect(page.getByLabel("What does your company do?")).toHaveValue(
        company.description,
      );
      await page.getByRole("button", { name: "Use these suggestions" }).click();
      await expect(page.getByLabel("What does your company do?")).toHaveValue(
        "We design websites and support customer projects.",
      );
      await page.getByRole("combobox", { name: "Industry" }).fill("consulting");
      await page.getByRole("combobox", { name: "Industry" }).press("Enter");
      await expect(
        page.getByRole("combobox", { name: "Industry" }),
      ).toHaveValue("Professional Services");
      await shot("company");
      await page.getByRole("button", { name: "Save and continue →" }).click();
      await expect(
        page.getByRole("heading", {
          name: "Give Opryn something real to learn.",
        }),
      ).toBeVisible();
      await shot("teach");
      await page
        .getByRole("button", { name: "Choose Google files", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      assert.equal(new URL(page.url()).pathname, "/onboarding");
      await shot("google-sheet");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Explain it/ }).click();
      await page
        .getByLabel("Give it a clear name")
        .fill("Refund approval limits");
      await page
        .getByLabel("Explain it naturally")
        .fill(
          "Managers may approve refunds up to $500. Anything above needs owner approval.",
        );
      await page
        .getByRole("button", { name: "Teach Opryn", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Opryn found something worth keeping.",
        }),
      ).toBeVisible();
      await shot("review");
      assert.equal(new URL(page.url()).pathname, "/onboarding");
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: "Ask your business a question." }),
      ).toBeVisible();
      await shot("try");
      await page.getByRole("button", { name: "Ask Opryn →" }).click();
      await expect(
        page.getByText("Answer from approved knowledge", { exact: true }),
      ).toBeVisible();
      await shot("answer");
      await page
        .getByRole("button", { name: "Continue →", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Start 5-day free trial" }),
      ).toBeEnabled();
      await shot("plans");
      await page
        .getByRole("button", { name: "Start 5-day free trial" })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Test checkout unavailable",
      );
      billingVerified = true;
      await page
        .getByRole("button", { name: "Check subscription / retry" })
        .click();
      await expect(
        page.getByRole("button", { name: "Continue to Opryn →" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue to Opryn →" }).click();
      await expect(
        page.getByRole("heading", { name: "Opryn is ready." }),
      ).toBeVisible();
      await shot("complete");
      await page.goto(origin + "/onboarding?existing");
      await expect(
        page.getByRole("heading", { name: "Continue setting up Opryn?" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Continue setup", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Choose how you want to continue." }),
      ).toBeVisible();
      assert.deepEqual(errors, []);
      console.log(
        `PASS actual activation components, mocked services: ${width}px, reduced=${reduced}, Google sheet stays in onboarding, Explain→review→approve→sourced answer→complete, saved-source resume`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((r) => server.close(r));
}
