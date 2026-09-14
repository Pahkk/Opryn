import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.OPRYN_AUDIT_URL || "https://www.opryn.app";
const folder =
  process.env.OPRYN_AUDIT_OUTPUT || "artifacts/premium-public/baseline";
await mkdir(folder, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const width of [1440, 390]) {
    for (const route of [
      "/",
      "/pricing",
      "/ai",
      "/integrations",
      "/about",
      "/security",
      "/contact",
      "/privacy",
      "/terms",
      "/login",
      "/signup",
    ]) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const response = await page.goto(base + route, {
        waitUntil: "networkidle",
      });
      report.push({
        width,
        route,
        status: response.status(),
        errors,
        ...(await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')
            ?.content,
          canonical: document.querySelector('link[rel="canonical"]')?.href,
          headings: [...document.querySelectorAll("h1,h2")].map(
            (e) => e.textContent,
          ),
          words: document.querySelector("main")?.innerText.split(/\s+/).length,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }))),
      });
      // Exercise normal scrolling so below-fold lazy images are captured too.
      for (
        let y = 0;
        y < (await page.evaluate(() => document.body.scrollHeight));
        y += 850
      ) {
        await page.evaluate((top) => scrollTo(0, top), y);
        await page.waitForTimeout(60);
      }
      await page
        .locator("img")
        .evaluateAll((images) =>
          Promise.all(
            images
              .filter((img) => img.getClientRects().length)
              .map((img) => img.decode().catch(() => {})),
          ),
        );
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: `${folder}/${route.slice(1) || "home"}-${width}.png`,
        fullPage: true,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
await writeFile(`${folder}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
