import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218";
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(base, { waitUntil: "networkidle" });
    const root = page.locator(".knowledge-centerpiece");
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-enhanced", "true");
    const seek = async (fraction) => {
      const target = await page.evaluate((p) => {
        const root = document.querySelector(".knowledge-centerpiece");
        const start =
          root.querySelector(".kc-track").getBoundingClientRect().top +
          scrollY -
          88;
        const target = start + Number(root.dataset.scrollDistance) * p;
        scrollTo({
          top: target,
          behavior: "instant",
        });
        return target;
      }, fraction);
      await expect
        .poll(() =>
          page.evaluate((target) => Math.abs(scrollY - target), target),
        )
        .toBeLessThan(2);
    };
    await seek(0);
    await page.mouse.move(650, 400);
    // Wheel events exercise native scrolling: no ScrollTo plugin / scroll hijacking.
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 360);
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(before + 300);
    for (let i = 0; i < 12; i++) {
      const previous = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, 12);
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeGreaterThan(previous + 8);
    }
    const beforeReverse = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, -240);
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeLessThan(beforeReverse - 200);
    await seek(112 / 153);
    await expect(page.locator(".kc-destination-4")).toHaveCSS("opacity", "1");
    for (const width of [1280, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() => root.getAttribute("data-scroll-distance"))
        .toBe("3420");
      await seek(112 / 153);
      await expect(page.locator(".kc-destination-4")).toHaveCSS("opacity", "1");
      await expect
        .poll(() =>
          root.evaluate((root) => {
            const card = root
              .querySelector(".kc-knowledge")
              .getBoundingClientRect();
            const svg = root.querySelector(".kc-paths").getBoundingClientRect();
            return Math.max(
              ...[...root.querySelectorAll(".kc-out-path")].map((path, i) => {
                const pt = path.getPointAtLength(0);
                return Math.abs(
                  pt.x + svg.left - (i < 2 ? card.left : card.right),
                );
              }),
            );
          }),
        )
        .toBeLessThan(2)
        .catch(async (error) => {
          console.log(
            await root.evaluate((root) => ({
              width: innerWidth,
              stage: root.dataset.storyStage,
              card: root
                .querySelector(".kc-knowledge")
                .getBoundingClientRect()
                .toJSON(),
              slot: root
                .querySelector(".kc-hub-slot")
                .getBoundingClientRect()
                .toJSON(),
              style: root.querySelector(".kc-knowledge").getAttribute("style"),
            })),
          );
          await page.screenshot({
            path: `artifacts/public-slate/story/resize-failure-${name}-${width}.png`,
          });
          throw error;
        });
    }
    // Rapid navigation and Back must rebuild one scene, not retain orphaned pins.
    await page.locator(".kc-after a").click();
    await expect(page).toHaveURL(/\/signup/);
    await page.goBack();
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-enhanced", "true");
    await expect(root.locator(".pin-spacer")).toHaveCount(1);
    for (const width of [768, 430, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(root).toHaveAttribute("data-mobile-story", "true");
      await root.locator(".kc-knowledge").scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          root
            .locator(".kc-progress")
            .evaluate((n) => Math.round(n.getBoundingClientRect().top)),
        )
        .toBe(76);
      await page.screenshot({
        path: `artifacts/public-slate/story/${name}-mobile-progress-${width}.png`,
      });
      await root.locator(".kc-feedback").scrollIntoViewIfNeeded();
      await expect(root.locator(".kc-gap-queued")).toBeVisible();
      await page.screenshot({
        path: `artifacts/public-slate/story/${name}-feedback-${width}.png`,
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(root).not.toHaveAttribute("data-mobile-story", "true");
    await expect(root.locator(".kc-progress")).toBeHidden();
    await expect(root.locator(".kc-gap-queued")).toHaveCSS("opacity", "1");
    await page.close();
    console.log(
      `${name}: wheel, trackpad-like deltas, same-breakpoint resize alignment, Back, mobile sticky progress, feedback, reduced motion passed.`,
    );
  } finally {
    await browser.close();
  }
}
