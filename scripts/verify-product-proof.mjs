import { chromium, webkit, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.OPRYN_PROOF_URL || "http://127.0.0.1:3224";
const folder = "artifacts/product-proof-scroll";
await mkdir(folder, { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await engine.launch();
  try {
    for (const width of [1440, 1024, 390, 430]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        deviceScaleFactor: 2,
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base);
      const proof = page.locator("#inside-opryn");
      await proof.scrollIntoViewIfNeeded();
      if (width >= 1024) {
        await expect(proof).toHaveAttribute("data-scroll-proof", "true");
        for (const [index, view] of [
          "teach",
          "knowledge",
          "needs-you",
          "connections",
          "teach",
        ].entries()) {
          const button = proof.locator(`#proof-tab-${view}`);
          await button.focus();
          await button.press("Enter");
          await expect(button).toHaveAttribute("aria-current", "step");
          const slide = proof.locator(`#proof-${view}`);
          await expect(slide).toHaveAttribute("aria-hidden", "false");
          await expect
            .poll(() => slide.evaluate((el) => getComputedStyle(el).clipPath))
            .toMatch(/^(none|inset\(0%)/);
          await expect
            .poll(() => slide.evaluate((el) => getComputedStyle(el).opacity))
            .toBe("1");
          await page.screenshot({
            path: `${folder}/${name}-${width}-${index}-${view}.png`,
          });
          assert.ok(
            (await proof.locator(".proof-stage").boundingBox()).y < 100,
          );
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(proof).not.toHaveAttribute("data-scroll-proof", "true");
        await expect(proof.locator(".pin-spacer")).toHaveCount(0);
        await page.setViewportSize({ width, height: 1000 });
        await expect(proof).toHaveAttribute("data-scroll-proof", "true");
      } else {
        await expect(proof.locator(".pin-spacer")).toHaveCount(0);
        for (const view of ["teach", "knowledge", "needs-you", "connections"]) {
          const slide = proof.locator(`#proof-${view}`);
          await slide.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              slide
                .locator(".proof-image")
                .evaluate((el) => getComputedStyle(el).clipPath),
            )
            .toMatch(/^(none|inset\(0%)/);
          await expect
            .poll(() =>
              slide
                .locator("img")
                .evaluate((image) => image.complete && image.naturalWidth),
            )
            .toBe(1170);
          await slide.screenshot({
            path: `${folder}/${name}-${width}-${view}.png`,
          });
        }
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(proof.locator(".pin-spacer")).toHaveCount(0);
      await expect(proof.locator("figure[aria-hidden='true']")).toHaveCount(0);
      await page.locator('.public-footer a[href="/signup"]').click();
      await expect(page.locator(".pin-spacer")).toHaveCount(0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log(
        `${name} ${width}: sharp images, responsive flow, cleanup and reduced motion passed`,
      );
    }
  } finally {
    await browser.close();
  }
}
