import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3210";
const output = resolve("artifacts/public-spacing");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto(base, { waitUntil: "networkidle" });
    for (const row of await page
      .locator(".editorial-home .integration-ledger-row")
      .all()) {
      const spacing = await row.evaluate((element) => {
        const logo = element.firstElementChild.getBoundingClientRect();
        const copy = element
          .querySelector(":scope > div")
          .getBoundingClientRect();
        return { gap: copy.left - logo.right, logoWidth: logo.width };
      });
      assert.ok(spacing.gap >= 16, `Logo gap at ${width}: ${spacing.gap}`);
      assert.equal(spacing.logoWidth, 44);
    }
    for (const price of await page.locator(".launch-price").all()) {
      const gap = await price.evaluate(
        (element) =>
          element.querySelector("small").getBoundingClientRect().left -
          element.querySelector("span").getBoundingClientRect().right,
      );
      assert.ok(gap >= 12, `Homepage price gap at ${width}: ${gap}`);
      await expect(price.locator("small")).toHaveCSS(
        "letter-spacing",
        "normal",
      );
    }
    await page
      .locator(".editorial-integrations")
      .screenshot({ path: resolve(output, `integrations-${width}.png`) });
    await page
      .locator(".launch-pricing")
      .screenshot({ path: resolve(output, `homepage-pricing-${width}.png`) });
    await expect(
      page
        .locator(".editorial-final")
        .getByRole("link", { name: "Talk to us" }),
    ).toHaveAttribute("href", "mailto:usersupport@opryn.app");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.goto(`${base}/pricing`, { waitUntil: "networkidle" });
    for (const price of await page.locator(".pricing-price-line").all()) {
      const gap = await price.evaluate(
        (element) =>
          element.querySelector("span").getBoundingClientRect().left -
          element.querySelector("strong").getBoundingClientRect().right,
      );
      assert.ok(gap >= 12, `Pricing page gap at ${width}: ${gap}`);
    }
    await page
      .locator(".pricing-plan")
      .first()
      .screenshot({ path: resolve(output, `pricing-plan-${width}.png`) });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.goto(`${base}/contact`, { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: "usersupport@opryn.app" }).first())
      .toHaveAttribute("href", "mailto:usersupport@opryn.app");
    await expect(page.getByText("Our public support contact is being finalized.", { exact: false }))
      .toHaveCount(0);
    await page.close();
  }
  console.log(
    `Spacing verified at 320, 390, 768, and 1440px. Screenshots: ${output}`,
  );
} finally {
  await browser.close();
}
