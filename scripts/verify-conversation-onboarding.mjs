import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(
  process.env.OPRYN_ESBUILD_MODULE
    ? pathToFileURL(process.env.OPRYN_ESBUILD_MODULE).href
    : "esbuild"
);
const root = process.cwd();
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {ConversationLearning} from './components/onboarding/conversation-learning';createRoot(document.getElementById('root')).render(<ConversationLearning organizationId="test-org" companyName="Example Studio" onPrepared={id=>document.getElementById('prepared').textContent=id}/>);`,
    resolveDir: root,
    loader: "jsx",
  },
  bundle: true,
  write: false,
  outfile: "fixture.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "fixture-next",
      setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "link",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`,
          loader: "jsx",
          resolveDir: root,
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("content-type", "application/javascript");
    return res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
  }
  const asset = path.resolve(
    "public",
    `.${new URL(req.url, "http://localhost").pathname}`,
  );
  if (
    asset.startsWith(path.resolve("public") + path.sep) &&
    existsSync(asset) &&
    /\.(svg|png|webp)$/.test(asset)
  ) {
    res.setHeader(
      "content-type",
      asset.endsWith(".svg") ? "image/svg+xml" : "image/png",
    );
    return res.end(readFileSync(asset));
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui;background:#fffcf7;color:#14213d}button,input{font:inherit}button{cursor:pointer}#root{max-width:1000px;margin:30px auto;padding:16px}dialog{padding:0;border:0;max-width:100vw}dialog::backdrop{background:#14213d55}.opryn-dialog{max-height:100dvh} .activation-primary{background:#2855f9;color:white;border:0;padding:14px;border-radius:14px}.activation-eyebrow{font-size:12px}.activation-back{padding:14px;margin-top:24px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden}${bundle.outputFiles
      .filter((f) => f.path.endsWith(".css"))
      .map((f) => f.text)
      .join(
        "\n",
      )}</style></head><body><div id="root"></div><output id="prepared"></output><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
mkdirSync("artifacts/conversation-onboarding", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 768, 390]) {
    const providerName = width === 768 ? "Claude" : "ChatGPT";
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.open = () => null;
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async () => {} },
      });
    });
    let saved = null,
      connected = false,
      job = null;
    const events = [];
    await page.route("**/api/onboarding/**", async (route) => {
      const req = route.request();
      assert.equal(req.headers()["x-opryn-organization"], "test-org");
      const url = new URL(req.url());
      if (url.pathname.endsWith("/learning-session")) {
        if (req.method() === "POST") {
          const body = req.postDataJSON();
          if (Object.hasOwn(body, "intent")) {
            saved = body.intent;
            if (saved && ["request", "waiting"].includes(saved.stage))
              saved = {
                ...saved,
                requestId: "40000000-0000-4000-8000-000000000001",
                expiresAt: new Date(Date.now() + 1800000).toISOString(),
              };
          }
          events.push(body.event);
          return route.fulfill({
            json: {
              saved: true,
              ...(Object.hasOwn(body, "intent") ? { intent: saved } : {}),
            },
          });
        }
        return route.fulfill({ json: { intent: saved, imports: [] } });
      }
      return route.fulfill({
        json: {
          connected,
          entitlement: { feature: "ai_conversation_learning", enabled: true },
          learningEnabled: connected,
          latestLearning: url.searchParams.has("since") ? job : null,
          requiresConfirmation: width === 768 && !!job,
        },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await expect(
      page.getByRole("button", {
        name: `Connect ${providerName}`,
        exact: true,
      }),
    ).toBeEnabled();
    await page.screenshot({
      path: `artifacts/conversation-onboarding/sources-${width}.png`,
    });
    await page
      .getByRole("button", { name: `Connect ${providerName}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `Add ${providerName} to Opryn` }),
    ).toBeVisible();
    await expect(
      page.getByText("Secure Opryn connection address"),
    ).toBeVisible();
    connected = true;
    await page
      .getByRole("button", { name: "Check connection", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "What should Opryn learn?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "A process", exact: false }).click();
    await page.getByLabel("Knowledge name").fill("Customer onboarding");
    await page.getByRole("button", { name: "Prepare request →" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Teach Opryn about Customer onboarding",
      }),
    ).toBeVisible();
    assert.equal(saved.name, "Customer onboarding");
    await page.getByRole("button", { name: `Open ${providerName} ↗` }).click();
    await expect(
      page.getByRole("heading", { name: `Waiting for ${providerName}…` }),
    ).toBeVisible();
    assert.ok(saved.since);
    assert.equal(saved.stage, "waiting");
    await page
      .getByRole("button", { name: "Close conversation learning" })
      .click();
    assert.equal(saved.stage, "waiting", "closing must preserve resume intent");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: `Waiting for ${providerName}…` }),
    ).toBeVisible();
    job = {
      id: "job-1",
      name: "Customer onboarding",
      status: "extracting",
      summary: {},
      processId: null,
      createdAt: new Date().toISOString(),
    };
    if (width === 768) {
      await expect(
        page.getByText("Is this the conversation you just sent?"),
      ).toBeVisible({ timeout: 10000 });
      await page
        .getByRole("button", { name: "Yes, review this conversation" })
        .click();
    }
    await expect(
      page.getByText("Finding useful processes and rules…"),
    ).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: `artifacts/conversation-onboarding/processing-${width}.png`,
    });
    job = {
      ...job,
      status: "needs_review",
      processId: "review-process",
      summary: { processes: 1, rules: 2, faqs: 0 },
    };
    await expect(
      page.getByRole("heading", { name: "Opryn found useful knowledge." }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(`Source: ${providerName} conversation · Needs Review`),
    ).toBeVisible();
    await page.screenshot({
      path: `artifacts/conversation-onboarding/review-${width}.png`,
    });
    await page.getByRole("button", { name: "Review findings →" }).click();
    assert.equal(
      await page.locator("#prepared").textContent(),
      "review-process",
    );
    assert.deepEqual(errors, []);
    assert.ok(events.includes("external_ai_learn_started"));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "no horizontal overflow",
    );
    assert.ok(
      await page
        .locator("dialog")
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      "sheet content must not clip horizontally",
    );
    await context.close();
    console.log(
      `PASS: ${width}px connect → request → saved resume → real processing → review callback; no provider calls or production writes`,
    );
  }
  const lockedContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const lockedPage = await lockedContext.newPage();
  let lockedIntent = null;
  await lockedPage.route("**/api/onboarding/**", async (route) => {
    if (route.request().url().includes("ai-connections/status"))
      return route.fulfill({ json: { connected: true, learningEnabled: true, entitlement: { feature: "ai_conversation_learning", enabled: false }, latestLearning: null } });
    if (route.request().method() === "POST") {
      lockedIntent = route.request().postDataJSON().intent ?? lockedIntent;
      return route.fulfill({ json: { saved: true, intent: lockedIntent } });
    }
    return route.fulfill({ json: { intent: lockedIntent, imports: [] } });
  });
  await lockedPage.route("**/api/billing/**", (route) => route.fulfill({ status: 503, json: { error: "Billing temporarily unavailable" } }));
  await lockedPage.goto(`http://127.0.0.1:${server.address().port}`);
  await expect(lockedPage.getByRole("button", { name: "Unlock with Premium" }).first()).toBeEnabled();
  await lockedPage.getByRole("button", { name: "Unlock with Premium" }).first().click();
  await expect(lockedPage.getByRole("heading", { name: "Unlock conversation learning" })).toBeVisible();
  assert.equal(lockedIntent.stage, "type");
  assert.equal(lockedIntent.provider, "chatgpt");
  await lockedPage.screenshot({ path: "artifacts/conversation-onboarding/premium-locked-390.png" });
  await lockedPage.getByRole("button", { name: "Not now" }).click();
  await expect(lockedPage.getByRole("heading", { name: "Unlock conversation learning" })).toHaveCount(0);
  await lockedContext.close();
  console.log("PASS non-Premium mobile: inline unlock, intent preserved, billing failure recoverable, no learning execution");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
