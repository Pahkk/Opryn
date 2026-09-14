import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const base = process.env.OPRYN_RELEASE_URL || "https://www.opryn.app";
const output = "artifacts/public-slate/live";
await mkdir(output, { recursive: true });
for (const path of ["/", "/login", "/pricing", "/app/needs-you"]) {
  const response = await fetch(base + path, { redirect: "manual" });
  assert.equal(response.status, path.startsWith("/app") ? 307 : 200);
  if (path.startsWith("/app"))
    assert.ok(response.headers.get("location")?.includes("/login"));
  console.log(path, response.status);
}
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: "networkidle" });
    await expect(page.locator(".editorial-hero")).toHaveCSS(
      "background-color",
      "rgb(244, 245, 246)",
    );
    await expect(
      page.getByRole("heading", { name: "Your information already exists." }),
    ).toHaveCount(1);
    await page.screenshot({ path: `${output}/hero-${width}.png` });
    const root = page.locator(".knowledge-centerpiece");
    await root.scrollIntoViewIfNeeded();
    if (width === 1440) {
      await expect(root).toHaveAttribute("data-enhanced", "true");
      await root.evaluate((root) => {
        const start =
          root.querySelector(".kc-track").getBoundingClientRect().top +
          scrollY -
          88;
        scrollTo({
          top: start + (Number(root.dataset.scrollDistance) * 112) / 153,
          behavior: "instant",
        });
      });
      await expect(root.locator(".kc-destination-4")).toHaveCSS("opacity", "1");
      await expect(root).toHaveAttribute("data-story-stage", "distribution");
    } else {
      await expect(root).toHaveAttribute("data-mobile-story", "true");
      await root.locator(".kc-knowledge").scrollIntoViewIfNeeded();
      await expect(root.locator(".kc-confirmed")).toHaveCSS(
        "transform",
        "matrix(1, 0, 0, 1, 0, 0)",
      );
      await expect(root.locator(".pin-spacer")).toHaveCount(0);
    }
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `${output}/story-${width}.png`,
    });
    await page.close();
    console.log(`Live ${width}px story smoke passed`);
  }
} finally {
  await browser.close();
}
