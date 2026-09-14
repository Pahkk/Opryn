import { build } from "esbuild";
import { createServer } from "node:http";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
const bundled = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{DeleteWorkspace}from'./components/app/settings/delete-workspace';createRoot(document.getElementById('root')).render(<DeleteWorkspace organizationId="10000000-0000-4000-8000-000000000001" name="Example Studio"/>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = readdirSync(".next/static/css")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(".next/static/css/" + f, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  if (req.url === "/test.js") {
    res.setHeader("Content-Type", "text/javascript");
    return res.end(bundled.outputFiles[0].text);
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{padding:24px;background:#f4f5f6;color:#171c22}#root{max-width:760px;margin:auto}</style></head><body><div id="root"></div><script src="/test.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
mkdirSync("artifacts/workspace-deletion", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    let requests = 0;
    await page.route("**/api/settings", async (route) => {
      requests++;
      expect(route.request().headers()["x-opryn-organization"]).toBe(
        "10000000-0000-4000-8000-000000000001",
      );
      await route.fulfill({
        status: 409,
        json: { error: "Stored file cleanup required. Nothing was deleted." },
      });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .getByRole("button", { name: "Delete workspace", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Permanently delete workspace" }),
    ).toBeDisabled();
    await page
      .getByLabel("Type the workspace name: Example Studio")
      .fill("Example Studio");
    await expect(
      page.getByRole("button", { name: "Permanently delete workspace" }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Permanently delete workspace" })
      .click();
    await expect(page.getByRole("alert")).toContainText("Nothing was deleted");
    expect(requests).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/workspace-deletion/confirm-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Keep workspace" }).click();
    await expect(
      page.getByRole("button", { name: "Delete workspace", exact: true }),
    ).toBeFocused();
    await page.close();
    console.log(
      `PASS deletion UI ${width}px: confirmation gate, server error, no overflow, cancel focus (mock API; no deletion).`,
    );
  }
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
