import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
const base = process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3210";
const output = resolve("artifacts/launch-public");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
const routes = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/security",
  "/about",
  "/ai",
  "/contact",
  "/signup",
  "/login",
];
const links = new Set();
try {
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of routes) {
      const response = await page.goto(base + route, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200, route);
      await expect(page.locator("h1")).toHaveCount(1);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} overflow at ${width}`,
      );
      if (width === 390)
        for (const href of await page
          .locator("a[href]")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("href")),
          ))
          if (href?.startsWith("/") && !href.startsWith("//"))
            links.add(href.split("#")[0] || "/");
      if (
        [390, 1440].includes(width) &&
        ["/pricing", "/ai", "/security", "/about", "/contact"].includes(route)
      )
        await page.screenshot({
          path: resolve(output, `${route.slice(1)}-${width}.png`),
          fullPage: true,
        });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.goto(base);
  const menu = page.getByRole("button", { name: "Toggle navigation menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.goto(base + "/pricing");
  await expect(
    page.getByRole("link", { name: "Start with Core", exact: true }),
  ).toHaveAttribute("href", /\/signup\?next=/);
  await page.getByRole("link", { name: "Start Premium", exact: true }).click();
  await expect(page).toHaveURL(/\/signup\?next=/);
  await page.getByLabel("Full name", { exact: true }).fill("Validation check");
  await page
    .getByLabel("Work email", { exact: true })
    .fill("validation@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("validation-only-123");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("does-not-match-123");
  const signupRequests = [];
  page.on("request", (r) => {
    if (r.url().includes("/auth/v1/signup")) signupRequests.push(r.url());
  });
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Passwords do not match",
  );
  assert.equal(
    signupRequests.length,
    0,
    "Validation must not submit an account",
  );
  for (const href of links) {
    const response = await page.request.get(base + href);
    assert.ok(response.status() < 400, `${href}: ${response.status()}`);
  }
  console.log(
    `Public routes passed at six widths; ${links.size} internal links checked. Keyboard menu, pricing entry, and local signup validation passed. No account, payment, OAuth authorization, or email delivery was performed.`,
  );
} finally {
  await browser.close();
}
