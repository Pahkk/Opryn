import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.env.HOME_URL || "http://localhost:3226";
mkdirSync("artifacts/home-loop", { recursive: true });
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const page = await browser.newPage();
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: width === 1280 ? 714 : 900 });
    await page.goto(base, { waitUntil: "networkidle" });
    const root = page.locator(".knowledge-centerpiece");
    if (width >= 1024) {
      await expect(root).toHaveAttribute("data-enhanced", "true");
      const seek = async progress => {
        await page.evaluate(progress => {
          const root = document.querySelector(".knowledge-centerpiece");
          const start = root.querySelector(".kc-track").getBoundingClientRect().top + scrollY - 88;
          scrollTo({ top: start + Number(root.dataset.scrollDistance) * progress, behavior: "instant" });
        }, progress);
        await page.waitForTimeout(1600);
      };
      await seek(1);
      const clearance = await page.locator(".kc-loop").evaluate(loop => {
        const path = loop.querySelector("svg path"), matrix = path.getScreenCTM();
        return [...loop.querySelectorAll(".kc-loop-label > span")].map(label => {
          const range = document.createRange(); range.selectNodeContents(label);
          const r = range.getBoundingClientRect();
          let distance = Infinity;
          for (let length = 0; length <= path.getTotalLength(); length += .5) {
            const point = path.getPointAtLength(length).matrixTransform(matrix);
            const dx = Math.max(r.left - point.x, 0, point.x - r.right);
            const dy = Math.max(r.top - point.y, 0, point.y - r.bottom);
            distance = Math.min(distance, Math.hypot(dx, dy));
          }
          return { label: label.textContent, distance };
        });
      });
      for (const item of clearance) assert.ok(item.distance >= 16, `${name} ${width} ${item.label}: clearance ${item.distance}`);
      console.log(name, width, clearance);
      await page.screenshot({ path: `artifacts/home-loop/${name}-${width}.png` });
      await seek(.65);
      await seek(1);
      await expect(page.locator(".kc-loop")).toBeVisible();
    } else {
      await page.locator(".kc-loop").scrollIntoViewIfNeeded();
      await expect(page.locator(".kc-loop > svg")).toBeHidden();
      await expect(page.locator(".kc-loop-label")).toHaveCount(4);
      await page.screenshot({ path: `artifacts/home-loop/${name}-${width}.png` });
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base, { waitUntil: "networkidle" });
  await expect(page.locator(".knowledge-centerpiece .pin-spacer")).toHaveCount(0);
  await page.locator(".kc-loop").scrollIntoViewIfNeeded();
  await expect(page.locator(".kc-loop-label")).toHaveCount(4);
  await browser.close();
}
