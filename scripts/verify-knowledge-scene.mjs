import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, webkit, expect } from "@playwright/test";

const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218";
const dir = process.env.OPRYN_STORY_OUTPUT || "artifacts/story-redesign";
mkdirSync(dir, { recursive: true });
const scenes = [
  ["information", 0.1, "information"],
  ["convergence", 0.215, "structure"],
  ["proposal", 0.3, "structure"],
  ["review", 0.43, "review"],
  ["approved", 0.575, "approved"],
  ["distribution", 0.8, "use"],
  ["knowledge-gap", 0.912, "learn"],
  ["return-to-review", 0.943, "learn"],
  ["final", 0.995, "learn"],
];
let checks = 0;
for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 1280, 1024, 768, 430, 390]) {
      console.log(engine, width);
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base, { waitUntil: "networkidle" });
      const root = page.locator(".knowledge-centerpiece");
      await root.scrollIntoViewIfNeeded();
      await expect(root.locator(".kc-knowledge")).toHaveCount(1);
      const card = await root.locator(".kc-knowledge").elementHandle();
      const noOverflow = async () =>
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "no horizontal overflow",
        );
      const seek = async (progress) => {
        // Above-fold lazy sections can finish settling before this section enters.
        // Always seek from the current trigger position, not a stale document offset.
        for (let attempt = 0; attempt < 2; attempt++) {
          await root.evaluate((node, progress) => {
            const track = node.querySelector(".kc-track");
            scrollTo({
              top:
                track.getBoundingClientRect().top +
                scrollY -
                88 +
                Number(node.dataset.scrollDistance) * progress,
              behavior: "instant",
            });
          }, progress);
          try {
            await page.waitForFunction(
              (progress) =>
                Math.abs(
                  Number(
                    document.querySelector(".knowledge-centerpiece").dataset
                      .storyProgress,
                  ) - progress,
                ) < 0.002,
              progress,
              { timeout: 5000 },
            );
            break;
          } catch (error) {
            if (attempt) throw error;
          }
        }
        await page.waitForTimeout(180);
      };
      if (width >= 1024) {
        await expect(root).toHaveAttribute("data-enhanced", "true");
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        for (const [name, progress, phase] of scenes) {
          console.log(" ", name);
          await seek(progress);
          await expect(root).toHaveAttribute("data-story-stage", phase);
          assert.ok(
            Math.abs((await root.locator(".kc-stage").boundingBox()).y - 88) <
              3,
            name + " pin",
          );
          assert.ok(
            await card.evaluate(
              (n) => n === document.querySelector(".kc-knowledge"),
            ),
            "same document/proposal/approved DOM node",
          );
          await noOverflow();
          assert.ok(
            await root.locator(".kc-headlines").evaluate((node) => {
              const lines = [...node.querySelectorAll(".kc-headline")];
              const visible = lines.filter((head) =>
                [...head.querySelectorAll("p > div > div")].some((line) => {
                  const a = line.getBoundingClientRect(),
                    b = line.parentElement.getBoundingClientRect();
                  return (
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
                  );
                }),
              );
              return visible.length === 1;
            }),
            name + " one readable masked headline",
          );
          const rail = await root
            .locator(".kc-progress-track i")
            .evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).d);
          assert.ok(
            Math.abs(rail - progress) < 0.004,
            "rail tracks smoothed scene progress",
          );
          if (
            ["proposal", "review", "approved", "distribution"].includes(name)
          ) {
            assert.ok(
              await root.locator(".kc-knowledge").evaluate((card) => {
                const outer = card.getBoundingClientRect();
                return [
                  ...card.querySelectorAll(
                    ".kc-rule, .kc-knowledge-top, .kc-provenance",
                  ),
                ].every((child) => {
                  const box = child.getBoundingClientRect();
                  return (
                    box.left >= outer.left - 1 &&
                    box.right <= outer.right + 1 &&
                    box.bottom <= outer.bottom + 1
                  );
                });
              }),
              name + " readable content inside card",
            );
          }
          if (name === "review")
            await expect(root.locator(".kc-authority")).toHaveCSS(
              "opacity",
              "1",
            );
          if (name === "approved")
            await expect(root.locator(".kc-authority")).toHaveCSS(
              "opacity",
              "0",
            );
          if (name === "distribution") {
            await expect(root.locator(".kc-destination-4")).toHaveCSS(
              "opacity",
              "1",
            );
            assert.ok(
              await root.evaluate((node) =>
                [...node.querySelectorAll(".kc-out-path")].every((path, i) => {
                  const point = path.getPointAtLength(0);
                  const hub = node.querySelector('[data-layout="hub"]');
                  return (
                    Math.abs(
                      point.x -
                        (i < 2
                          ? hub.offsetLeft
                          : hub.offsetLeft + hub.offsetWidth),
                    ) < 2
                  );
                }),
              ),
              "paths originate on hub",
            );
          }
          if (name === "knowledge-gap")
            await expect(root.locator(".kc-gap-answer")).toHaveCSS(
              "opacity",
              "1",
            );
          if (name === "return-to-review")
            await expect(root.locator(".kc-new-proposal")).toHaveCSS(
              "opacity",
              "1",
            );
          await page.screenshot({
            path: dir + "/" + engine + "-" + width + "-" + name + ".png",
          });
          checks += 7;
        }
        await seek(0.1);
        const original = await root.locator(".kc-knowledge").boundingBox();
        for (const progress of [0.9, 0.2, 0.75, 0.13, 0.97]) {
          await root.evaluate(
            (node, p) =>
              scrollTo({
                top:
                  node.querySelector(".kc-track").getBoundingClientRect().top +
                  scrollY -
                  88 +
                  Number(node.dataset.scrollDistance) * p,
                behavior: "instant",
              }),
            progress,
          );
        }
        await seek(0.1);
        const restored = await root.locator(".kc-knowledge").boundingBox();
        for (const k of ["x", "y", "width", "height"])
          assert.ok(
            Math.abs(restored[k] - original[k]) < 1,
            "reverse restores " + k,
          );
        await seek(0.43);
        await page.reload({ waitUntil: "networkidle" });
        await expect(root).toHaveAttribute("data-enhanced", "true");
        await seek(0.43);
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(root).not.toHaveAttribute("data-enhanced", "true");
        await expect(root.locator(".pin-spacer")).toHaveCount(0);
        await page.setViewportSize({ width, height: 900 });
        await expect(root).toHaveAttribute("data-enhanced", "true");
        await expect(root.locator(".pin-spacer")).toHaveCount(1);
        await seek(0.43);
        await noOverflow();
        await page
          .getByRole("button", { name: "Read without animation" })
          .click();
        await expect(root.locator(".pin-spacer")).toHaveCount(0);
        await expect(root.locator(".kc-authority")).toBeVisible();
        await page.getByRole("button", { name: "Enable storytelling" }).click();
        await expect(root).toHaveAttribute("data-enhanced", "true");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(root.locator(".pin-spacer")).toHaveCount(0);
        checks += 12;
      } else {
        await expect(root).toHaveAttribute("data-mobile-story", "true");
        await expect(root.locator(".pin-spacer")).toHaveCount(0);
        for (const selector of [
          ".kc-sources",
          ".kc-proposal",
          ".kc-destinations",
          ".kc-feedback",
          ".kc-loop",
        ]) {
          await root.locator(selector).scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
          await page.screenshot({
            path:
              dir +
              "/" +
              engine +
              "-" +
              width +
              "-" +
              selector.slice(4) +
              ".png",
          });
          await noOverflow();
        }
        await expect(root.locator(".kc-authority")).toBeVisible();
        await expect(root.locator(".kc-confirmed")).toBeVisible();
        checks += 8;
      }
      assert.deepEqual(errors, [], "no browser errors");
      await page.locator('.public-footer a[href="/signup"]').click();
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.locator("#how-it-works .pin-spacer")).toHaveCount(0);
      await page.goBack({ waitUntil: "networkidle" });
      await expect(page.locator("#how-it-works")).toBeVisible();
      await context.close();
      checks += 3;
    }
    for (const options of [
      { reducedMotion: "reduce" },
      { javaScriptEnabled: false },
    ]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        ...options,
      });
      await page.goto(base, { waitUntil: "networkidle" });
      const root = page.locator(".knowledge-centerpiece");
      await expect(root.locator(".pin-spacer")).toHaveCount(0);
      await expect(root.locator(".kc-authority")).toBeVisible();
      await expect(root.locator(".kc-confirmed")).toBeVisible();
      await expect(root.locator(".kc-gap-answer")).toBeVisible();
      await root.screenshot({
        path:
          dir +
          "/" +
          engine +
          "-" +
          (options.javaScriptEnabled === false ? "no-js" : "reduced-motion") +
          ".png",
      });
      await page.close();
      checks += 4;
    }
  } finally {
    await browser.close();
  }
}
console.log(
  "Passed " +
    checks +
    " browser assertions. Illustrative marketing workflow; no business actions or external requests executed.",
);
