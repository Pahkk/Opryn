import { expect, test } from "@playwright/test";
for (const width of [390, 768, 1440]) {
  for (const reduced of [false, true]) {
    test(`clear homepage ${width}px reduced=${reduced}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await expect(page.locator("main > section")).toHaveCount(8);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveAccessibleName(
        "Teach your business once.",
      );
      await expect(
        page.locator(".editorial-hero .editorial-lead"),
      ).toContainText("employees and connected AI");
      await expect(
        page.locator(".editorial-hero .editorial-footnote"),
      ).toContainText("Decide what becomes official");
      await expect(page.locator(".knowledge-flow")).toHaveCount(1);
      await expect(page.locator(".opryn-marketing-image")).toHaveCount(3);
      await expect(
        page.locator(".pin-spacer,.knowledge-centerpiece,.knowledge-rotator"),
      ).toHaveCount(0);
      await expect(
        page.locator('a[href="/integrations"]', { hasText: "View all" }),
      ).toBeVisible();
      for (const href of ["/pricing", "/integrations", "/security", "/signup"])
        expect(
          await page.locator(`main a[href="${href}"]`).count(),
        ).toBeGreaterThan(0);
      for (const anchor of await page
        .locator('a[href^="#"],a[href^="/#"]')
        .evaluateAll((links) =>
          links.map((e) => e.getAttribute("href")!.split("#")[1]),
        ))
        expect(await page.locator(`[id="${anchor}"]`).count()).toBe(1);
      const dimensions = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      expect(dimensions.overflow).toBeLessThanOrEqual(1);
      await page
        .getByRole("link", { name: "See how it works", exact: true })
        .click();
      await expect(page).toHaveURL(/#how-it-works$/);
      await expect(page.locator("#how-it-works")).toBeInViewport();
      expect(errors).toEqual([]);
    });
  }
}
test("essential explanation remains visible without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator(".flow-answer h3")).toHaveText(
    "Project-lead approval required.",
  );
  await expect(page.locator(".flow-answer h3")).toBeVisible();
  await expect(page.locator("main > section")).toHaveCount(8);
  await context.close();
});
