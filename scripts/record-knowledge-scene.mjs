import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: "artifacts/story-redesign/video",
      size: { width: 1440, height: 900 },
    },
  });
  const page = await context.newPage();
  await page.goto(process.env.OPRYN_HOME_TEST_URL || "http://127.0.0.1:3218", {
    waitUntil: "networkidle",
  });
  const section = page.locator(".knowledge-centerpiece");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute("data-enhanced", "true");
  await page.waitForTimeout(800);
  const start = await page
    .locator(".kc-track")
    .evaluate((n) => n.getBoundingClientRect().top + scrollY - 88);
  await page.evaluate(
    (start) => scrollTo({ top: start, behavior: "instant" }),
    start,
  );
  // Simulates a visitor's steady scroll for recording; not shipped page behavior.
  await page.evaluate(
    (start) =>
      new Promise((resolve) => {
        const began = performance.now();
        function frame(now) {
          const p = Math.min(1, (now - began) / 32000);
          scrollTo({
            top:
              start +
              Number(
                document.querySelector(".knowledge-centerpiece").dataset
                  .scrollDistance,
              ) *
                p,
            behavior: "instant",
          });
          if (p < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      }),
    start,
  );
  await expect(page.locator(".kc-loop")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "artifacts/story-redesign/recording-final.png",
  });
  await context.close();
  await page
    .video()
    .saveAs("artifacts/story-redesign/signature-walkthrough.webm");
  console.log(
    "Saved signature-walkthrough.webm: continuous 32-second forward scroll.",
  );
} finally {
  await browser.close();
}
