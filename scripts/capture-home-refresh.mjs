import { chromium, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.HOME_URL || "https://www.opryn.app";
const label = process.env.HOME_LABEL || "live";
const dir = `artifacts/home-refresh/${label}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base, { waitUntil: "networkidle" });
await page.screenshot({ path: `${dir}/hero.png` });
const story = page.locator(".knowledge-centerpiece");
await story.scrollIntoViewIfNeeded();
await expect(story).toHaveAttribute("data-enhanced", "true", {
  timeout: 15000,
});
for (const [name, progress] of [
  ["information", 0.1],
  ["structure", 0.27],
  ["review", 0.41],
  ["approved", 0.57],
  ["use", 0.8],
  ["learn", 0.91],
]) {
  await page.evaluate((p) => {
    const r = document.querySelector(".knowledge-centerpiece");
    const t = r.querySelector(".kc-track");
    scrollTo({
      top:
        t.getBoundingClientRect().top +
        scrollY -
        88 +
        Number(r.dataset.scrollDistance || 0) * p,
      behavior: "instant",
    });
  }, progress);
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${dir}/${name}.png` });
}
for (const [name, selector] of [
  ["answer-everywhere", "#answer-everywhere"],
  ["integrations", ".editorial-integrations"],
  ["pricing", ".launch-pricing"],
  ["footer", ".public-footer"],
]) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${dir}/${name}.png` });
}
await page.setViewportSize({ width: 1440, height: 714 });
await page.goto(base, { waitUntil: "networkidle" });
await story.scrollIntoViewIfNeeded();
await page.waitForTimeout(2000);
const laptop = await story.evaluate((r) => ({
  enhanced: r.dataset.enhanced,
  mobile: r.dataset.mobileStory,
  viewport: [innerWidth, innerHeight],
}));
await page.screenshot({ path: `${dir}/laptop-story.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: "networkidle" });
await page.screenshot({ path: `${dir}/mobile-hero.png` });
await page.emulateMedia({ reducedMotion: "reduce" });
await story.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${dir}/reduced.png` });
writeFileSync(
  `${dir}/audit.json`,
  JSON.stringify({ base, laptop, errors }, null, 2),
);
console.log({ dir, laptop, errors });
await browser.close();
