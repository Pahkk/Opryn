import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
const root = resolve(new URL("..", import.meta.url).pathname),
  output = resolve(root, "artifacts/motion");
mkdirSync(output, { recursive: true });
const result = await build({
  entryPoints: [resolve(root, "scripts/motion-ui-fixture.jsx")],
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  alias: { "@": root },
  define: { "process.env.NODE_ENV": '"development"' },
});
const cssDir = resolve(root, ".next/static/css");
const css = readdirSync(cssDir)
  .filter((n) => n.endsWith(".css"))
  .map((n) => readFileSync(resolve(cssDir, n), "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(result.outputFiles[0].text);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
  .fixture-nav{padding:20px;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #ddd} main{max-width:960px;margin:auto;padding:24px}h1{font-size:24px}button,input{min-height:44px;padding:8px;border:1px solid #ccc;border-radius:8px}p{margin:16px 0}.library-sheet{background:white;padding:24px;max-width:520px;height:100%}
  </style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => !!window.motionFixture);
    const settled = () =>
      page.waitForFunction(() => window.motionFixture.active() === 0);
    await settled();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    checks++;
    await page.getByLabel("Unsaved note").fill("Preserve this unsaved note");
    await page.evaluate(() => {
      for (let step = 1; step < 18; step++)
        window.motionFixture.update({ step });
    });
    await settled();
    assert.equal(
      await page.getByLabel("Unsaved note").inputValue(),
      "Preserve this unsaved note",
    );
    checks++;
    assert.equal(
      await page
        .locator(".fixture-content")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    checks++;
    assert.equal(
      await page
        .locator(".fixture-nav")
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    checks++;
    await page.evaluate(() =>
      window.motionFixture.update({ rows: ["Policy", "Pricing"] }),
    );
    assert.equal(
      await page
        .locator('[data-motion-row="Policy"]')
        .evaluate((e) => e.style.opacity),
      "",
    );
    checks++;
    await page.evaluate(() => {
      for (let i = 0; i < 12; i++)
        window.motionFixture.update({ rows: ["Policy", `New ${i}`] });
    });
    await settled();
    assert.equal(await page.locator("[data-motion-row]").count(), 2);
    checks++;
    await page.evaluate(() => window.motionFixture.update({ step: 30 }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await settled();
    assert.equal(
      await page
        .locator(".fixture-content")
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    checks++;
    assert.equal(await page.locator(".tabular-nums").innerText(), "72");
    checks++;
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.evaluate(() => {
      window.motionFixture.update({ step: 31 });
      window.motionFixture.update({ reduced: true });
    });
    await settled();
    assert.equal(
      await page
        .locator(".fixture-content")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    checks++;
    await page.evaluate(() =>
      window.motionFixture.update({ reduced: false, step: 32, error: true }),
    );
    assert.equal(
      await page
        .getByRole("alert")
        .evaluate((e) => getComputedStyle(e.parentElement).opacity),
      "1",
    );
    checks++;
    await page.evaluate(() => window.motionFixture.update({ error: false }));
    await page.getByRole("button", { name: "Open details" }).click();
    await page.getByRole("dialog").waitFor();
    await settled();
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((e) => getComputedStyle(e).transform),
      "none",
    );
    checks++;
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Open details",
    );
    checks++;
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) {
        window.motionFixture.update({ open: true });
        window.motionFixture.update({ open: false });
      }
    });
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    checks++;
    // Explicit visibility-event simulation, not a claim of real device sleep.
    await page.evaluate(() => {
      window.motionFixture.update({ step: 33 });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await settled();
    assert.equal(
      await page
        .locator(".fixture-content")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    checks++;
    await page.evaluate(() => {
      delete document.hidden;
      window.motionFixture.fail();
    });
    assert.equal(
      await page
        .locator(".fixture-content")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    checks++;
    await page.evaluate(() => {
      window.motionFixture.update({ step: 34, open: true });
      window.motionFixture.update({ mounted: false });
    });
    assert.equal(await page.evaluate(() => window.motionFixture.active()), 0);
    checks++;
    await page.evaluate(() =>
      window.motionFixture.update({ mounted: true, open: false, step: 0 }),
    );
    await settled();
    if ([390, 1440].includes(width))
      await page.screenshot({
        path: resolve(output, `motion-${width}.png`),
        fullPage: true,
      });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.evaluate(() => window.motionFixture.update({ step: 35 }));
    await settled();
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    await page.close();
  }
  console.log(
    `Passed ${checks} real GSAP/React lifecycle assertions at 360/390/430/768/1440px. Local fixtures only.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
