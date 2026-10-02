// Isolated actual React components. All task APIs are mocked; never writes production data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";

const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  stdin: {
    contents: `import React from'react';import{createRoot}from'react-dom/client';import{KnowledgeDemo}from'./components/marketing/knowledge-demo';import{OprynAction,useActionFeedback}from'./components/motion/opryn-action';import{TrainingButton}from'./components/app/training-button';import{InboxAction}from'./components/app/learning-inbox-actions';import{PublicAction}from'./components/marketing/public-motion';import{FeedbackToast}from'./components/motion/feedback-toast';import{SystemLoading}from'./components/motion/system-loading';import'./components/marketing/clear-home.css';function Fixture(){const f=useActionFeedback();async function task(){const r=await fetch('/api/fixture',{method:'POST'});if(!r.ok)throw Error('Could not save. Try again.')}return <main style={{maxWidth:1000,margin:'0 auto',padding:24}}><h1>Opryn feedback verification</h1><section aria-label="Actions" style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:24}}><OprynAction label="Save setup" pendingLabel="Saving…" successLabel="Saved" rolling arrow state={f.state} errorMessage={f.error} onClick={()=>{void f.run(task);void f.run(task)}}/><TrainingButton processId="fixture-process" status="not_started"/><InboxAction action={{action:'resolve_feedback',feedbackId:'fixture-feedback'}} primary>Resolve</InboxAction><PublicAction href="#demo" rolling>Get started</PublicAction></section><div id="demo" style={{maxWidth:540}}><KnowledgeDemo/></div><SystemLoading/><FeedbackToast toast={null} onDismiss={()=>{}}/></main>}createRoot(document.getElementById('root')).render(<Fixture/>);`,
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
            ? "const router={refresh(){window.fixtureRefreshes=(window.fixtureRefreshes||0)+1}};export const useRouter=()=>router;"
            : 'import React from"react";export default function Link({prefetch,...props}){return <a {...props}/>}',
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  if (req.url === "/favicon-48x48.png") {
    res.setHeader("content-type", "image/png");
    res.end(readFileSync("public/favicon-48x48.png"));
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fffcf7;color:#14213d;font-family:Arial}button{font:inherit}*{box-sizing:border-box}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}${bundle.outputFiles.find((f) => f.path.endsWith(".css")).text}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const output = "artifacts/feedback-system";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
let assertions = 0;
try {
  for (const width of [1440, 768, 390, 360])
    for (const reduced of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        reducedMotion: reduced ? "reduce" : "no-preference",
        ...(width === 1440 && !reduced
          ? {
              recordVideo: {
                dir: `${output}/recordings`,
                size: { width: 1440, height: 900 },
              },
            }
          : {}),
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const counts = {};
      let failure = true;
      await page.route("**/api/**", async (route) => {
        const key = new URL(route.request().url()).pathname;
        counts[key] = (counts[key] || 0) + 1;
        await new Promise((r) => setTimeout(r, 250));
        await route.fulfill({
          status: failure ? 503 : 200,
          json: failure
            ? { error: "Could not save. Try again." }
            : { ok: true },
        });
      });
      await page.goto(base);
      const cta = page.getByRole("link", { name: "Get started", exact: true });
      assert.equal(
        await cta.locator("[data-action-label]").textContent(),
        "Get started",
      );
      await expect(
        page.locator(".public-action-duplicate,.opryn-roll-copy"),
      ).toHaveCount(0);
      await cta.focus();
      await expect
        .poll(async () =>
          cta.locator("[data-action-label]").evaluate((element) => {
            const transform = new DOMMatrixReadOnly(
              getComputedStyle(element).transform,
            );
            return Math.abs(transform.m42);
          }),
        )
        .toBeLessThanOrEqual(1.1);
      assertions += 3;
      const save = page.getByRole("button", {
        name: "Save setup",
        exact: true,
      });
      await save.focus();
      await save.press("Enter");
      await expect(
        page.getByRole("button", { name: "Saving…", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Saved", exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole("alert")).toContainText("Could not save");
      assert.equal(
        counts["/api/fixture"],
        1,
        "Synchronous duplicate calls must share one request",
      );
      assertions += 3;
      failure = false;
      await save.click();
      await expect(
        page.getByRole("button", { name: "Saved", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Saved", exact: true }),
      ).toHaveCSS("background-color", "rgb(237, 240, 244)");
      failure = true;
      await page
        .getByRole("button", { name: "Mark Complete", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "Your progress wasn't saved",
      );
      await expect(
        page.getByRole("button", { name: "Completed", exact: true }),
      ).toHaveCount(0);
      failure = false;
      await page
        .getByRole("button", { name: "Mark Complete", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Completed", exact: true }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Resolve", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Saved", exact: true }),
      ).toHaveCount(2);
      assertions += 5;
      const source = page.locator(".clear-example-policy");
      const handle = await source.elementHandle();
      await expect(
        page.getByRole("button", { name: "03 Use", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Review example", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Approve example", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Approved", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "See how it’s used →", exact: true })
        .click();
      await expect(page.locator(".demo-response")).toContainText(
        "Additional revisions require project-lead approval",
      );
      await page.getByRole("button", { name: "Your AI", exact: true }).click();
      await expect(page.locator(".demo-response")).toContainText(
        "Authorized connection",
      );
      for (let i = 0; i < 4; i++) {
        await page
          .getByRole("button", {
            name: i % 2 ? "Your AI" : "Your team",
            exact: true,
          })
          .click();
      }
      assert.equal(
        await handle.evaluate(
          (e) => e === document.querySelector(".clear-example-policy"),
        ),
        true,
        "Knowledge object must remain mounted",
      );
      await page
        .getByRole("button", { name: "Missing answer", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Ask the right person", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Create proposal", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Proposed · Needs review",
          exact: true,
        }),
      ).toBeDisabled();
      assert.equal(
        Object.keys(counts).length,
        3,
        "Demo must not call a backend or external provider",
      );
      await expect(page.locator(".knowledge-demo .demo-scene")).toHaveCount(2);
      await page.screenshot({
        path: `${output}/feedback-${width}${reduced ? "-reduced" : ""}.png`,
        fullPage: true,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "No horizontal overflow",
      );
      assert.ok(
        await page
          .locator(".knowledge-demo")
          .evaluate((e) => e.getBoundingClientRect().height < 1000),
        "Demo must stay compact, without SVG layout inflation",
      );
      if (reduced)
        assert.equal(
          await page
            .locator(".opryn-logo-sprite")
            .evaluate((e) => getComputedStyle(e).animationName),
          "none",
        );
      await page.getByRole("button", { name: "Replay", exact: true }).click();
      await expect(page.locator(".demo-review-status")).toContainText(
        "Needs review",
      );
      assert.deepEqual(errors, []);
      assertions += 8;
      await context.close();
    }
  console.log(
    `PASS: ${assertions} feedback assertions across desktop/tablet/mobile and reduced motion. Screenshots + desktop video: ${output}`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
