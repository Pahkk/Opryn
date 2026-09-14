// Real public components on a local production server; no customer data/API writes.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch();
const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218";
const output = "artifacts/signature-motion";
mkdirSync(output, { recursive: true });
let checks = 0;
try {
  for (const width of [360, 390, 430, 768, 1440]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base, { waitUntil: "networkidle" });
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".headline-mask > span")).toHaveCSS(
        "transform",
        "none",
      );
      // The old teaching illustration is now covered by verify-knowledge-centerpiece.
      for (const kind of ["distribute"]) {
        const story = page.locator(`.signature-${kind}`);
        await story.scrollIntoViewIfNeeded();
        // Allow the one-shot IntersectionObserver timeline (maximum 910ms) to
        // enter before asserting its resting pose; SSR is also fully visible.
        await page.waitForTimeout(950);
        await expect(story.locator("path").first()).toHaveCSS(
          "stroke-dashoffset",
          "0px",
        );
        await expect(
          story
            .locator(kind === "teach" ? "li" : ".distribution-destination")
            .last(),
        ).toHaveCSS("opacity", "1");
        if ([390, 1440].includes(width) && reducedMotion === "no-preference") {
          await story.screenshot({ path: `${output}/${kind}-${width}.png` });
        }
        checks += 2;
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      checks += 4;
      if (width === 1440) {
        const surface = page.locator(".pointer-surface").first();
        await surface.scrollIntoViewIfNeeded();
        const box = await surface.boundingBox();
        await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4);
        // Sample the actual tween frames rather than asserting only the final pose.
        const maximum = await surface
          .locator(".pointer-plane")
          .evaluate(async (node) => {
            let max = 0;
            for (let i = 0; i < 25; i++) {
              await new Promise(requestAnimationFrame);
              const matrix = new DOMMatrixReadOnly(
                getComputedStyle(node).transform,
              );
              max = Math.max(max, Math.hypot(matrix.m41, matrix.m42));
            }
            return max;
          });
        assert.ok(maximum < 4);
        if (reducedMotion === "reduce") assert.equal(maximum, 0);
        checks++;
      }
      await page.close();
    }
  }
  console.log(
    `Passed ${checks} signature motion assertions, normal/reduced motion at five widths. Public UI only.`,
  );
} finally {
  await browser.close();
}
