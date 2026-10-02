import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
const browser = await chromium.launch();
const measurements = [];
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("http://localhost:3100", { waitUntil: "networkidle" });
    await page.screenshot({
      path: `artifacts/clear-home/after-${width}.png`,
      fullPage: true,
    });
    await page.screenshot({ path: `artifacts/clear-home/hero-${width}.png` });
    measurements.push({
      width,
      height: await page.evaluate(() => document.documentElement.scrollHeight),
    });
    await page.close();
  }
  writeFileSync(
    "artifacts/clear-home/after.json",
    JSON.stringify(measurements, null, 2),
  );
  console.log({
    before: JSON.parse(
      readFileSync("artifacts/clear-home/before.json", "utf8"),
    ),
    after: measurements,
  });
} finally {
  await browser.close();
}
