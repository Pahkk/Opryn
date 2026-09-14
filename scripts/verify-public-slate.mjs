import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, webkit, expect } from "@playwright/test";

const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218";
const dir = "artifacts/public-slate/surfaces";
mkdirSync(dir, { recursive: true });
const rgb = (hex) => hex.match(/\w\w/g).map((x) => parseInt(x, 16));
const luminance = (hex) =>
  rgb(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
for (const [fg, bg] of [
  ["171c22", "f4f5f6"],
  ["5b6672", "dde4eb"],
  ["fafaf9", "536b82"],
  ["34495e", "dde4eb"],
  ["45634f", "e5ece6"],
  ["785b2a", "f1eadc"],
]) {
  assert.ok(contrast(fg, bg) >= 4.5, `Insufficient contrast: ${fg}/${bg}`);
  console.log(`Contrast ${fg}/${bg}: ${contrast(fg, bg).toFixed(2)}:1`);
}
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  if (process.env.OPRYN_QA_ENGINE && process.env.OPRYN_QA_ENGINE !== name)
    continue;
  const browser = await engine.launch();
  try {
    for (const width of [1440, 1280, 768, 430, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await expect(page.locator(".editorial-hero")).toHaveCSS(
        "background-color",
        "rgb(244, 245, 246)",
      );
      await expect(page.locator(".editorial-approved")).toHaveCSS(
        "color",
        "rgb(69, 99, 79)",
      );
      await expect(page.locator(".editorial-demo > footer")).toHaveCSS(
        "color",
        "rgb(52, 73, 94)",
      );
      await expect(page.locator(".editorial-update-source > span")).toHaveCSS(
        "color",
        "rgb(69, 99, 79)",
      );
      await expect(page.locator(".kc-doc svg")).toHaveCSS(
        "color",
        "rgb(66, 133, 244)",
      );
      await expect(page.locator(".kc-sheet svg")).toHaveCSS(
        "color",
        "rgb(24, 128, 56)",
      );
      await expect(page.locator(".distribution-path").first()).toHaveCSS(
        "stroke",
        "rgb(83, 107, 130)",
      );
      const positioning = await page.locator(".editorial-home").innerText();
      assert.ok(!/\b(Notion|Confluence|Guru|Glean)\b/i.test(positioning));
      assert.equal(
        await page
          .locator(".kc-comparison,.kc-editorial-comparison,.kc-contrast")
          .count(),
        0,
      );
      assert.equal(
        await page
          .locator("svg.lucide-sparkles,svg.lucide-star,svg.lucide-wand")
          .count(),
        0,
      );
      for (const [selector, label] of [
        [".editorial-hero", "hero"],
        [".kc-difference", "why-opryn"],
        [".editorial-final", "final-cta"],
        [".editorial-footer", "footer"],
      ]) {
        const target = page.locator(selector);
        await target.evaluate((node) =>
          scrollTo({
            top: node.getBoundingClientRect().top + scrollY - 76,
            behavior: "instant",
          }),
        );
        await page.screenshot({
          path: `${dir}/${name}-${label}-${width}.png`,
        });
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      for (const route of [
        "/pricing",
        "/security",
        "/about",
        "/ai",
        "/privacy",
        "/terms",
        "/contact",
      ]) {
        // Isolate route rendering from canceled prefetches on forced document navigation.
        const routePage = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
        });
        const routeErrors = [];
        routePage.on("pageerror", (e) => routeErrors.push(e.message));
        assert.equal(
          (
            await routePage.goto(base + route, { waitUntil: "networkidle" })
          ).status(),
          200,
        );
        assert.ok(
          await routePage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} overflow at ${width}`,
        );
        await expect(routePage.locator("h1")).toHaveCount(1);
        const wrapper = routePage.locator(
          ".knowledge-public-site,.legal-document",
        );
        await expect(wrapper).toHaveCSS(
          "background-color",
          "rgb(244, 245, 246)",
        );
        if (["/pricing", "/security"].includes(route))
          await routePage.screenshot({
            path: `${dir}/${name}-${route.slice(1)}-${width}.png`,
          });
        assert.deepEqual(routeErrors, []);
        await routePage.close();
      }
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        `${name} ${width}: public palette, official logo colors, neutral positioning, links and overflow passed.`,
      );
    }
  } finally {
    await browser.close();
  }
}
