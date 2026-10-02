import { chromium, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const directory = "artifacts/feedback-system";
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      recordVideo:
        width === 1440
          ? { dir: `${directory}/homepage-recordings` }
          : undefined,
    });
    const page = await context.newPage();
    await page.goto(
      process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3101",
      { waitUntil: "networkidle" },
    );
    await page.screenshot({
      path: `${directory}/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "02 Review", exact: true }).click();
    await page
      .getByRole("button", { name: "Approve example", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Approved", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /See how it.s used/ }).click();
    await expect(page.locator(".knowledge-demo .demo-scene")).toHaveCount(2);
    await page.screenshot({ path: `${directory}/home-use-${width}.png` });
    await page.getByRole("button", { name: "Your AI", exact: true }).click();
    await expect(page.locator(".knowledge-demo .demo-scene")).toHaveCount(2);
    await page.screenshot({ path: `${directory}/home-ai-${width}.png` });
    await context.close();
  }
  console.log(
    "Captured built homepage and example approval/use at 390/768/1440px; desktop recording saved.",
  );
} finally {
  await browser.close();
}
