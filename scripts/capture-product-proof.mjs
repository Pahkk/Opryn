// Actual application components, isolated sample props, no customer data or auth.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
const root = process.cwd();
const output = path.join(root, "public/product-proof");
mkdirSync(output, { recursive: true });
const bundle = await build({
  entryPoints: ["scripts/product-ui-fixture.jsx"],
  bundle: true,
  write: false,
  outfile: "proof.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": root },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.invalid"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '"sample-not-a-key"',
  },
  plugins: [
    {
      name: "isolated-screenshot",
      setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, (a) => ({
          path: a.path,
          namespace: "proof",
        }));
        b.onLoad({ filter: /.*/, namespace: "proof" }, (a) => ({
          loader: "jsx",
          resolveDir: root,
          contents: a.path.endsWith("navigation")
            ? `export const usePathname=()=>({'teach-google':'/app/processes/new',knowledge:'/app/processes',needs:'/app/needs-you',integrations:'/app/integrations'}[new URLSearchParams(location.search).get('screen')]??'/app');export const useRouter=()=>({refresh(){},push(){},replace(){}});export const useSearchParams=()=>new URLSearchParams(location.search);`
            : a.path.endsWith("link")
              ? `import React from 'react';export default function Link({prefetch,...p}){return <a {...p}/>}`
              : `import React from 'react';export default function Image({fill,priority,unoptimized,...p}){return <img {...p} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:p.style}/>} `,
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((n) => n.endsWith(".css"))
  .map((n) => readFileSync(`.next/static/css/${n}`, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/proof.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  const asset = path.resolve("public", `.${pathname}`);
  if (
    asset.startsWith(path.resolve("public") + path.sep) &&
    existsSync(asset) &&
    /\.(png|webp|svg|jpg)$/.test(asset)
  ) {
    res.setHeader(
      "Content-Type",
      asset.endsWith("svg")
        ? "image/svg+xml"
        : asset.endsWith("webp")
          ? "image/webp"
          : "image/png",
    );
    res.end(readFileSync(asset));
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${bundle.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? ""}</style><div id="root"></div><script src="/proof.js"></script></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
try {
  for (const [name, screen] of [
    ["teach", "teach-google"],
    ["knowledge", "knowledge"],
    ["needs-you", "needs"],
    ["connections", "integrations"],
  ]) {
    for (const width of [1180, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 800 },
        deviceScaleFactor: 3,
        reducedMotion: "reduce",
      });
      await page.route("**/api/**", (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            attempts: [],
            connections: [],
            intent: null,
            imports: [],
          }),
        }),
      );
      await page.goto(
        `http://127.0.0.1:${server.address().port}/?screen=${screen}`,
      );
      await page.locator("#workspace-main").waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) => img.decode().catch(() => {})),
        );
      });
      await page.screenshot({
        path: `artifacts/premium-public/${name}-${width}.png`,
      });
      await sharp(await page.screenshot())
        .webp({ lossless: true, effort: 6 })
        .toFile(`${output}/${name}-${width}-retina.webp`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log("Captured actual component views with sample fixture data only.");
