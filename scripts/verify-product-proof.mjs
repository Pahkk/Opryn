import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
const base = process.env.OPRYN_PROOF_URL || "http://localhost:3222";
for (const [name, engine] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const b = await engine.launch();
  const p = await b.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  for (const [width, height] of [
    [1440, 900],
    [1280, 714],
    [1024, 768],
    [430, 844],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await p.goto(base, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "View the actual interface" }).click();
    for (const title of ["Teach", "Knowledge", "Needs You", "Connections"]) {
      await p.getByRole("tab", { name: title, exact: true }).click();
      await expect(p.locator(".proof-slide")).toHaveCount(1);
      const img = p.locator(".proof-image img");
      await expect
        .poll(() => img.evaluate((e) => e.complete && e.naturalWidth > 0))
        .toBe(true);
      const info = await img.evaluate((e) => ({
        natural: e.naturalWidth,
        rendered: e.getBoundingClientRect().width,
        src: e.currentSrc,
      }));
      assert.ok(info.natural >= info.rendered, "Screenshot is not upscaled");
      assert.ok(info.src.includes(width <= 600 ? "390-retina" : "1180-retina"));
    }
    await expect(p.locator(".product-proof .pin-spacer")).toHaveCount(0);
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p
      .getByRole("tab", { name: "Connections", exact: true })
      .press("Home");
    await expect(
      p.getByRole("tab", { name: "Teach", exact: true }),
    ).toBeFocused();
    await expect(p.locator(".proof-slide")).toHaveCount(1);
    await p.emulateMedia({ reducedMotion: "no-preference" });
  }
  assert.deepEqual(errors, []);
  console.log(
    name +
      ": product-proof tabs, responsive retina sources, keyboard, no pin, reduced motion passed at five geometries",
  );
  await b.close();
}
