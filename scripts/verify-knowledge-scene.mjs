import assert from "node:assert/strict";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { chromium, webkit, expect } from "@playwright/test";
const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218";
const dir = process.env.OPRYN_STORY_OUTPUT || "artifacts/public-slate/story";
mkdirSync(dir, { recursive: true });
let checks = 0;
for (const [engine, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 1280, 1024, 768, 430, 390]) {
      console.log(`Checking ${engine} ${width}px`);
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(width === 1440 && engine === "chromium"
          ? {
              recordVideo: {
                dir: dir + "/video",
                size: { width: 1440, height: 900 },
              },
            }
          : {}),
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base, { waitUntil: "networkidle" });
      const section = page.locator(".knowledge-centerpiece");
      await section.scrollIntoViewIfNeeded();
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(section.locator(".kc-knowledge")).toHaveCount(1);
      if (width >= 1024) {
        await expect(section).toHaveAttribute("data-enhanced", "true");
        const card = await section.locator(".kc-knowledge").elementHandle();
        const start = await page
          .locator(".kc-track")
          .evaluate((n) => n.getBoundingClientRect().top + scrollY - 88);
        const seek = async (p) => {
          await page.evaluate(
            ({ start, p }) =>
              scrollTo(
                0,
                start +
                  Number(
                    document.querySelector(".knowledge-centerpiece").dataset
                      .scrollDistance,
                  ) *
                    p,
              ),
            { start, p },
          );
          // Wait for scrub to converge across actual frames, not a guessed sleep.
          await page.evaluate(
            () =>
              new Promise((resolve, reject) => {
                let last = "",
                  stable = 0;
                const begin = performance.now();
                function frame() {
                  const value = [
                    ...document.querySelectorAll(
                      ".kc-knowledge,.kc-fragment,.kc-headline>p,.kc-destination,.kc-status",
                    ),
                  ]
                    .map((n) => n.getAttribute("style"))
                    .join();
                  stable = value === last ? stable + 1 : 0;
                  last = value;
                  if (stable > 8 && performance.now() - begin > 800) resolve();
                  else if (performance.now() - begin > 8000)
                    reject(
                      new Error("Scrub did not settle: " + value.slice(0, 350)),
                    );
                  else requestAnimationFrame(frame);
                }
                frame();
              }),
          );
        };
        for (const [scene, p] of [
          ["sources", 22 / 153],
          ["old-way", 37 / 153],
          ["converge", 49 / 153],
          ["structured", 61 / 153],
          ["review", 75 / 153],
          ["approved", 88 / 153],
          ["distribution", 112 / 153],
          ["gap", 127 / 153],
          ["feedback", 134 / 153],
          ["learning", 135 / 153],
          ["final", 1],
        ]) {
          console.log(`  ${scene}`);
          await seek(p);
          assert.ok(
            Math.abs((await page.locator(".kc-stage").boundingBox()).y - 88) <
              3,
            scene + " pin",
          );
          assert.equal(
            await card.evaluate(
              (n) => n === document.querySelector(".kc-knowledge"),
            ),
            true,
          );
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            true,
          );
          const visibleHeadlines = await page
            .locator(".kc-headline>p")
            .evaluateAll(
              (nodes) =>
                nodes.filter((n) => {
                  const a = n.getBoundingClientRect(),
                    b = n.parentElement.getBoundingClientRect();
                  return (
                    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
                  );
                }).length,
            );
          assert.equal(
            visibleHeadlines,
            1,
            scene + " has one unclipped headline",
          );
          if (width === 1440 || width === 1024)
            await page.screenshot({
              path: `${dir}/${engine}-${width}-${scene}.png`,
            });
          if (scene === "sources")
            await expect(section.locator(".kc-doc")).toHaveCSS("opacity", "1");
          if (scene === "approved" || scene === "distribution")
            await expect(section.locator(".kc-confirmed")).toHaveCSS(
              "transform",
              "matrix(1, 0, 0, 1, 0, 0)",
            );
          if (scene === "distribution")
            await expect(section.locator(".kc-destination-4")).toHaveCSS(
              "opacity",
              "1",
            );
          if (scene === "distribution")
            assert.ok(
              await section.evaluate((root) =>
                [...root.querySelectorAll(".kc-out-path")].every((path, i) => {
                  const point = path.getPointAtLength(0),
                    card = root.querySelector(".kc-hub-slot"),
                    expected =
                      i < 2
                        ? card.offsetLeft
                        : card.offsetLeft + card.offsetWidth;
                  return Math.abs(point.x - expected) < 2;
                }),
              ),
              "paths originate at rule",
            );
          if (scene === "final")
            assert.ok(
              await section.evaluate((root) => {
                const card = root
                    .querySelector(".kc-knowledge")
                    .getBoundingClientRect(),
                  copy = root
                    .querySelector(".kc-positioning")
                    .getBoundingClientRect();
                return card.bottom - 65 * 0.88 < copy.top;
              }),
              "final caption clears card",
            );
          const rail = await section
            .locator(".kc-progress-track i")
            .evaluate((n) => new DOMMatrix(getComputedStyle(n).transform).d);
          assert.ok(
            Math.abs(rail - p) < 0.003,
            "rail matches real scroll progress",
          );
          if (scene === "feedback") {
            await expect(section.locator(".kc-gap-queued")).toHaveCSS(
              "opacity",
              "1",
            );
            await expect(section).toHaveAttribute(
              "data-story-stage",
              "feedback",
            );
          }
          checks += 5;
        }
        // Reverse to exactly the same source arrangement, then stress direction changes.
        await seek(22 / 153);
        assert.ok(
          await section.locator(".kc-doc").evaluate((n) => {
            const m = new DOMMatrix(getComputedStyle(n).transform);
            return (
              Math.abs(m.m11 - 1) < 0.001 &&
              Math.abs(m.m22 - 1) < 0.001 &&
              Math.abs(m.m41) < 0.1 &&
              Math.abs(m.m42) < 0.1
            );
          }),
          "reverse restores source position and scale, with perspective retained",
        );
        for (const p of [0.9, 0.25, 0.7, 0.1, 0.98])
          await page.evaluate(
            ({ start, p }) =>
              scrollTo(
                0,
                start +
                  Number(
                    document.querySelector(".knowledge-centerpiece").dataset
                      .scrollDistance,
                  ) *
                    p,
              ),
            { start, p },
          );
        await seek(75 / 153);
        await expect(section.locator(".kc-authority")).toHaveCSS(
          "opacity",
          "1",
        );
        await page.setViewportSize({ width: 390, height: 900 });
        await expect(section).not.toHaveAttribute("data-enhanced", "true");
        await expect(section.locator(".pin-spacer")).toHaveCount(0);
        await page.setViewportSize({ width, height: 900 });
        await expect(section).toHaveAttribute("data-enhanced", "true");
        await expect(section.locator(".pin-spacer")).toHaveCount(1);
        await page
          .getByRole("button", { name: "Read without animation" })
          .click();
        await expect(section.locator(".pin-spacer")).toHaveCount(0);
        await expect(section.locator(".kc-knowledge")).toHaveCSS(
          "opacity",
          "1",
        );
        await page.getByRole("button", { name: "Enable storytelling" }).click();
        await expect(section).toHaveAttribute("data-enhanced", "true");
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(section.locator(".pin-spacer")).toHaveCount(0);
        checks += 10;
      } else {
        await expect(section.locator(".pin-spacer")).toHaveCount(0);
        await section.locator(".kc-knowledge").scrollIntoViewIfNeeded();
        await expect(section.locator(".kc-knowledge")).toHaveCSS(
          "opacity",
          "1",
        );
        await expect(section.locator(".kc-confirmed")).toHaveCSS(
          "transform",
          "matrix(1, 0, 0, 1, 0, 0)",
        );
        await expect(section.locator(".kc-authority")).toHaveCSS(
          "height",
          "0px",
        );
        await expect(section.locator(".kc-confirmation")).toHaveCSS(
          "opacity",
          "1",
        );
        await page.screenshot({ path: `${dir}/${engine}-review-${width}.png` });
        await page.locator(".kc-difference").scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${dir}/${engine}-difference-${width}.png`,
        });
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        checks += 3;
      }
      assert.deepEqual(errors, []);
      checks += 3;
      // Real client navigation must remove the pinned scene and its spacer.
      await page.locator('.public-footer a[href="/signup"]').click();
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.locator(".pin-spacer")).toHaveCount(0);
      checks += 2;
      await context.close();
      if (width === 1440 && engine === "chromium")
        await page.video().saveAs(`${dir}/walkthrough.webm`);
    }
    for (const opts of [
      { javaScriptEnabled: false },
      { reducedMotion: "reduce" },
    ]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        ...opts,
      });
      await page.goto(base);
      await expect(
        page.locator(".knowledge-centerpiece .pin-spacer"),
      ).toHaveCount(0);
      await expect(page.locator(".kc-knowledge")).toBeVisible();
      await expect(page.locator(".kc-confirmed")).toBeVisible();
      await page.close();
      checks += 3;
    }
    const chunks = readdirSync(".next/static/chunks").filter((name) =>
      name.endsWith(".js"),
    );
    const storyChunk = chunks.find((name) =>
      readFileSync(`.next/static/chunks/${name}`, "utf8").includes(
        "opryn-knowledge-centerpiece",
      ),
    );
    assert.ok(storyChunk);
    const failed = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await failed.route(`**/${storyChunk}`, (route) => route.abort());
    await failed.goto(base);
    await failed.locator(".knowledge-centerpiece").scrollIntoViewIfNeeded();
    await expect(failed.locator(".knowledge-centerpiece")).toHaveAttribute(
      "data-fallback",
      "true",
    );
    await expect(failed.locator(".kc-track")).toHaveCSS("min-height", "0px");
    await expect(failed.locator(".kc-knowledge")).toBeVisible();
    await failed.close();
    checks += 3;
  } finally {
    await browser.close();
  }
}
console.log(
  `Passed ${checks} continuous-scene checks in Chromium and WebKit. Illustrative UI only.`,
);
