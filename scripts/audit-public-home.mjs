import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch();
mkdirSync("artifacts/clear-home", { recursive: true });
const results = [];
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto("https://www.opryn.app", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `artifacts/clear-home/before-${width}.png`,
      fullPage: true,
    });
    results.push({
      width,
      ...(await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        headings: [...document.querySelectorAll("main h2")].map(
          (e) => e.textContent,
        ),
      }))),
    });
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  for (const route of ["integrations", "pricing", "ai", "security"]) {
    await page.goto(`https://www.opryn.app/${route}`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({
      path: `artifacts/clear-home/live-${route}.png`,
      fullPage: true,
    });
    console.log(route, (await page.locator("main").innerText()).slice(0, 6000));
  }
  writeFileSync(
    "artifacts/clear-home/before.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
