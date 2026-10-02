import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.env.HOME_URL || "http://localhost:3220";
const dir = "artifacts/home-refresh/qa";
mkdirSync(dir, { recursive: true });
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const b = await engine.launch();
  const context = await b.newContext({
    viewport: { width: 1440, height: 900 },
    ...(name === "chromium"
      ? {
          recordVideo: {
            dir: `${dir}/recordings`,
            size: { width: 1440, height: 900 },
          },
        }
      : {}),
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base, { waitUntil: "networkidle" });
  const root = p.locator(".knowledge-centerpiece");
  const seek = async (progress) => {
    await p.evaluate((progress) => {
      const r = document.querySelector(".knowledge-centerpiece");
      scrollTo({
        top:
          r.querySelector(".kc-track").getBoundingClientRect().top +
          scrollY -
          88 +
          Number(r.dataset.scrollDistance) * progress,
        behavior: "instant",
      });
    }, progress);
    await expect
      .poll(
        async () =>
          Math.abs(
            Number(await root.getAttribute("data-story-progress")) - progress,
          ),
        { timeout: 8000 },
      )
      .toBeLessThan(0.005);
  };
  for (const [width, height] of [
    [1440, 900],
    [1440, 714],
    [1280, 720],
    [1024, 768],
    [1280, 620],
  ]) {
    await p.setViewportSize({ width, height });
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute("data-enhanced", "true");
    await p.waitForTimeout(350);
    for (const [stage, progress] of [
      ["information", 0.1],
      ["structure", 0.29],
      ["review", 0.42],
      ["approved", 0.57],
      ["use", 0.8],
      ["learn", 0.91],
    ]) {
      await seek(progress);
      await expect(root).toHaveAttribute("data-story-stage", stage);
      const box = await root.locator(".kc-knowledge").boundingBox();
      if (stage === "review" || stage === "approved")
        assert.ok(
          box.y >= 85 && box.y + box.height <= height + 2,
          `${name} ${width}x${height} ${stage} card clipped: ${JSON.stringify(box)}`,
        );
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "No horizontal overflow",
      );
      if (width === 1440)
        await p.screenshot({ path: `${dir}/${name}-${height}-${stage}.png` });
    }
    await seek(0.1);
    await expect(root.locator(".kc-sheet")).toHaveCSS("opacity", "1");
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.waitForTimeout(400);
  await seek(0.55);
  await p.reload({ waitUntil: "networkidle" });
  await expect(root).toHaveAttribute("data-enhanced", "true");
  await seek(0.55);
  await expect(root.locator(".pin-spacer")).toHaveCount(1);
  for (const width of [768, 430, 390]) {
    await p.setViewportSize({ width, height: 844 });
    await expect(root).toHaveAttribute("data-mobile-story", "true");
    await expect(root.locator(".pin-spacer")).toHaveCount(0);
    await p.getByRole("button", { name: "View the actual interface" }).click();
    for (const title of ["Knowledge", "Connections", "Teach", "Needs You"]) {
      await p.getByRole("tab", { name: title, exact: true }).click();
      await expect(
        p.getByRole("tab", { name: title, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await expect(p.locator(".proof-slide")).toHaveCount(1);
    }
    await p
      .getByRole("tab", { name: "Needs You", exact: true })
      .press("ArrowRight");
    await expect(
      p.getByRole("tab", { name: "Connections", exact: true }),
    ).toBeFocused();
    await p.screenshot({ path: `${dir}/${name}-proof-${width}.png` });
    await p.getByRole("button", { name: "Close interface preview" }).click();
    await p.getByRole("button", { name: "Toggle navigation menu" }).click();
    await expect(
      p.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
    await p
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Pricing", exact: true })
      .focus()
      .catch(() => {});
    await p
      .getByRole("button", { name: "Toggle navigation menu" })
      .press("Escape");
    await expect(
      p.getByRole("navigation", { name: "Mobile navigation" }),
    ).toHaveCount(0);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await expect(root.locator(".pin-spacer")).toHaveCount(0);
  await expect(root).not.toHaveAttribute("data-enhanced", "true");
  await p
    .locator(".hero-demo-controls")
    .getByRole("button", { name: "Connected AI" })
    .click();
  await expect(p.locator(".hero-answer")).toContainText(
    "Owner approval is required",
  );
  await p
    .getByRole("group", { name: "Explore knowledge states" })
    .getByRole("button", { name: "Unknown", exact: true })
    .click();
  await expect(p.locator(".trust-example")).toContainText("No approved answer");
  await p
    .getByRole("group", { name: "Connection purpose" })
    .getByRole("button", { name: "Learn from", exact: true })
    .click();
  await expect(p.locator(".home-integration-item")).toHaveCount(2);
  await p.locator(".home-integration-item").first().getByRole("button").click();
  await expect(p.locator(".home-integration-detail")).toContainText(
    "does not import",
  );
  await p.locator('.public-footer a[href="/security"]').click();
  await expect(p).toHaveURL(/\/security$/);
  await p.goBack();
  await expect(p.locator("h1")).toHaveText("Teach your business once.");
  assert.deepEqual(errors, []);
  console.log(
    `${name}: six stages at five desktop geometries, reverse, refresh, three mobile widths, tabs/keyboard, menu, hero, trust, integration filters, reduced motion and route return passed`,
  );
  await context.close();
  await b.close();
}
