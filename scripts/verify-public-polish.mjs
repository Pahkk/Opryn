import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
const base = process.env.OPRYN_AUDIT_URL || "http://127.0.0.1:3222";
const dir = "artifacts/premium-public/details";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const links = new Set();
const results = [];
try {
  for (const width of [375, 390, 430, 768, 1280, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    for (const route of [
      "/",
      "/pricing",
      "/ai",
      "/integrations",
      "/about",
      "/security",
      "/contact",
    ]) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${route} ${width} overflow`,
      );
      for (const href of await page
        .locator('a[href^="/"]')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href"))))
        links.add(href);
      if (route === "/") {
        await page.screenshot({ path: `${dir}/hero-${width}.png` });
        for (const [name, selector] of [
          ["inside-opryn", "#inside-opryn"],
          ["why-opryn", "#why-opryn"],
          ["connections", "#integrations"],
          ["pricing", ".launch-pricing"],
          ["final-cta", ".editorial-final"],
        ]) {
          const section = page.locator(selector);
          if (!(await section.count())) continue;
          await section.scrollIntoViewIfNeeded();
          await section
            .locator("img:visible")
            .evaluateAll((images) =>
              Promise.all(images.map((img) => img.decode())),
            );
          await section.screenshot({
            path: `${dir}/${name}-${width}.png`,
            style: ".public-nav { visibility: hidden !important; }",
          });
        }
      }
      results.push({ route, width, overflow: false });
    }
    await page.close();
  }
  const page = await browser.newPage();
  const checked = [];
  for (const href of links) {
    const url = new URL(href, base);
    const response = await page.request.get(url.href);
    assert.ok(response.status() < 400, `${href}: ${response.status()}`);
    if (url.hash) {
      await page.goto(url.href);
      await expect(page.locator(`[id="${url.hash.slice(1)}"]`)).toHaveCount(1);
    }
    checked.push({ href, status: response.status() });
  }
  await writeFile(
    `${dir}/checks.json`,
    JSON.stringify({ layouts: results, links: checked }, null, 2),
  );
  console.log(
    `${results.length} layout checks and ${checked.length} internal destinations passed. No purchase, OAuth or email submission performed.`,
  );
} finally {
  await browser.close();
}
