// Isolated actual React icon components; no authenticated workspace mutation.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const files = [
  "0ee83465-83bf-4fc2-9cc2-7aa059f274b1",
  "1c9a7356-801c-444a-9ce3-50bf07432d1d",
  "3b307f97-1d3e-4428-8852-8b0969473f50",
  "843d8ce8-037b-4563-a6c9-55a01de91389",
  "cd2be86f-155d-4a14-abff-ca92a1275aed",
  "d80bafe8-e2da-4e66-8bad-cb6481649edd",
  "dea063a3-e18d-45d3-bf89-776317a6abfd",
  "e9021800-0bb7-4798-a17a-d0943ddbc791",
  "f196e284-e39e-4e7a-a2b5-f719fe848eb9",
  "f8848d0b-ceb2-4b24-a589-e0dadbc4156c",
];
for (const file of files) {
  const hash = (path) =>
    createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(
    hash(`public/opryn-icons/${file}.png`),
    hash(`/Users/nikitapakhomov/Desktop/OPryn icons/${file}.png`),
  );
}
const bundle = await build({
  stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{OprynIcon,oprynIconAssets}from'./components/opryn-icons/opryn-icon';import{SuccessCheck}from'./components/motion/success-check';createRoot(document.getElementById('root')).render(<main><h1>Opryn original icon system</h1><p>Component verification · not a customer workspace</p><section>{Object.keys(oprynIconAssets).map(name=><button key={name} type="button" aria-label={name}><OprynIcon name={name} size={36}/><span>{name}</span></button>)}</section><h2>Selected and confirmed states</h2><div className="states"><OprynIcon name="knowledge" size={44} active/><OprynIcon name="needs-you" size={44} attention/><SuccessCheck variant="milestone"/><OprynIcon name="teach" size={36} disabled/></div><button id="account" onClick={()=>document.body.dataset.motion='reduced'}>Reduce account motion</button></main>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  outfile: "icons.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": process.cwd() },
});
const server = createServer((req, res) => {
  if (req.url === "/icons.js") {
    res.setHeader("content-type", "application/javascript");
    res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  if (/^\/opryn-icons\/[a-f0-9-]+\.png$/.test(req.url ?? "")) {
    res.setHeader("content-type", "image/png");
    res.end(readFileSync(`public${req.url}`));
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#fffcf7;color:#14213d;font-family:Arial;margin:0}main{padding:28px;max-width:1000px;margin:auto}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}button{display:flex;align-items:center;gap:10px;min-height:60px;padding:12px;background:white;border:1px solid #dbe7f5;border-radius:16px;color:#14213d;font:inherit;text-align:left}button:hover,button:focus-visible{background:#eaf4ff}button:focus-visible{outline:2px solid #2855f9;outline-offset:3px}.states{display:flex;gap:30px;padding:20px}h1{font-size:28px}${bundle.outputFiles.find((f) => f.path.endsWith(".css")).text}</style></head><body><div id="root"></div><script src="/icons.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
mkdirSync("artifacts/opryn-icons", { recursive: true });
const browser = await chromium.launch();
let checks = 10;
try {
  for (const width of [390, 768, 1440])
    for (const reduced of [false, true]) {
      const page = await browser.newPage({
        viewport: { width, height: 960 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await expect(
        page.getByRole("button", { name: "teach", exact: true }),
      ).toBeVisible();
      await page.waitForFunction(() =>
        Array.from(document.images).every(
          (i) => i.complete && i.naturalWidth === 1254,
        ),
      );
      checks++;
      assert.equal(
        await page
          .locator(".opryn-icon-art img")
          .evaluateAll((images) =>
            images.every(
              (i) =>
                getComputedStyle(i).objectFit === "contain" &&
                i.draggable === false &&
                i.alt === "" &&
                Math.abs(i.width - i.height) < 1,
            ),
          ),
        true,
      );
      checks++;
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      checks++;
      const teach = page.getByRole("button", { name: "teach", exact: true });
      await teach.focus();
      await expect(teach.locator("[data-opryn-icon]")).toHaveAttribute(
        "data-icon-state",
        "hover",
      );
      checks++;
      await page.waitForTimeout(450);
      if (reduced) {
        assert.equal(
          await teach
            .locator(".opryn-icon-art")
            .evaluate((e) => getComputedStyle(e).transform),
          "none" /* Motion may emit identity matrix */,
        );
      }
      await page.screenshot({
        path: `artifacts/opryn-icons/icons-${width}${reduced ? "-reduced" : ""}.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Reduce account motion" }).click();
      await teach.focus();
      await page.waitForTimeout(100);
      assert.equal(await teach.locator(".opryn-icon-halo").count(), 0);
      checks++;
      assert.deepEqual(errors, []);
      checks++;
      await page.close();
    }
  console.log(`PASS: ${checks} asset-integrity and rendered icon checks.`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
