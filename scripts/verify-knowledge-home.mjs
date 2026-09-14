import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3210";
const output = resolve("artifacts/public-slate/home");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(base, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await expect(page.locator("h1")).toContainText("Teach your business once.");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveAccessibleName(
      "Teach your business once.",
    );
    await expect(page.locator(".knowledge-static")).toBeVisible();
    await expect(page.locator(".editorial-home")).toHaveCSS(
      "background-color",
      "rgb(244, 245, 246)",
    );
    await expect(
      page.locator(".editorial-hero .story-button-primary"),
    ).toHaveCSS("background-color", "rgb(83, 107, 130)");
    await page
      .locator(".editorial-hero")
      .screenshot({ path: resolve(output, `hero-${width}.png`) });
    const editorial = page.locator(".editorial-image img");
    assert.equal(await editorial.count(), 1);
    assert.equal(
      await page.locator('.editorial-image img[loading="lazy"]').count(),
      1,
    );
    for (const artwork of await editorial.all()) {
      await artwork.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          artwork.evaluate((img) => img.complete && img.naturalWidth > 0),
        )
        .toBe(true);
      assert.ok((await artwork.getAttribute("alt")).length > 30);
      assert.ok(
        (await artwork.getAttribute("srcset")).includes("/_next/image"),
      );
    }
    checks += 8;
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    for (const anchor of [
      "product",
      "how-it-works",
      "integrations",
      "security",
    ])
      assert.equal(await page.locator(`[id="${anchor}"]`).count(), 1);
    const demo = page.getByRole("group", { name: "Choose example consumer" });
    await demo
      .getByRole("button", { name: "Team member", exact: true })
      .click();
    await expect(
      page.locator(".shared-answer-stack .is-current h3"),
    ).toHaveText("Two revision rounds.");
    await demo
      .getByRole("button", { name: "Website bot", exact: true })
      .click();
    await expect(
      page.locator(".shared-answer-stack .is-current h3"),
    ).toHaveText("Additional rounds require project lead approval.");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(output, `homepage-${width}.png`),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    checks += 11;
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const rotator = page.locator(".knowledge-rotator");
  const before = await rotator.boundingBox();
  const first = await rotator.locator(".is-current").textContent();
  await expect
    .poll(() => rotator.locator(".is-current").textContent(), { timeout: 6000 })
    .not.toBe(first);
  const after = await rotator.boundingBox();
  assert.equal(before.height, after.height);
  await page
    .getByRole("button", { name: "Pause headline", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume headline" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: resolve(output, "hero-motion-390.png") });
  await page.locator(".editorial-demo").scrollIntoViewIfNeeded();
  const firstAnswer = await page
    .locator(".shared-answer-stack .is-current h3")
    .textContent();
  await expect
    .poll(
      () => page.locator(".shared-answer-stack .is-current h3").textContent(),
      {
        timeout: 7000,
      },
    )
    .not.toBe(firstAnswer);
  await expect(page.locator(".editorial-update-result")).toHaveText(
    "Available on the next authorized lookup.",
  );
  // Offscreen means no repeating work, even when the user has not pressed pause.
  await page
    .getByRole("button", { name: "Resume headline", exact: true })
    .click();
  await page.locator(".editorial-final").scrollIntoViewIfNeeded();
  const offscreenAnswer = await page
    .locator(".shared-answer-stack .is-current h3")
    .textContent();
  const offscreenHeadline = await rotator.locator(".is-current").textContent();
  await page.waitForTimeout(5600); // Longer than the demo's full interval.
  assert.equal(
    await page.locator(".shared-answer-stack .is-current h3").textContent(),
    offscreenAnswer,
  );
  assert.equal(
    await rotator.locator(".is-current").textContent(),
    offscreenHeadline,
  );
  await expect(page.locator(".public-nav > div")).toHaveCSS("height", "64px");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".public-nav > div")).toHaveCSS("height", "76px");
  await page.close();

  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await desktop.goto(base, { waitUntil: "networkidle" });
  await desktop
    .getByRole("button", { name: "Pause headline", exact: true })
    .click();
  await desktop
    .getByRole("button", { name: "Pause demo", exact: true })
    .click();
  await desktop.screenshot({ path: resolve(output, "desktop-initial.png") });
  for (const [selector, name] of [
    [".editorial-panels", "feature-panels"],
    [".knowledge-centerpiece", "knowledge-flow"],
    [".editorial-footer", "footer"],
  ]) {
    const section = desktop.locator(selector);
    await section.scrollIntoViewIfNeeded();
    if (selector === ".editorial-panels")
      await expect(section.locator("article").first()).toHaveCSS(
        "opacity",
        "1",
      );
    if (selector === ".knowledge-centerpiece") {
      await desktop.getByRole("button", { name: "Read without animation" }).click();
      await expect(section.locator(".kc-knowledge")).toHaveCSS("opacity", "1");
      await expect(section.locator(".kc-confirmed")).toBeVisible();
    }
    await section.screenshot({ path: resolve(output, `${name}-1440.png`) });
  }
  await desktop.close();

  const noJS = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  await noJS.goto(base);
  await expect(noJS.getByRole("heading", { level: 1 })).toHaveText(
    "Teach your business once.",
  );
  await expect(noJS.locator(".editorial-feature").first()).toBeVisible();
  await expect(noJS.locator(".kc-stage")).toHaveCSS("opacity", "1");
  await expect(
    noJS.locator(".editorial-hero .story-button-primary"),
  ).toHaveAttribute("href", "/signup");
  await noJS.close();
  checks += 5;
  console.log(
    `Passed ${checks} public homepage checks. Screenshots: ${output}. Demos are illustrative, not live integration evidence.`,
  );
} finally {
  await browser.close();
}
