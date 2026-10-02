// Actual AppShell with isolated router/Guide adapters. No Supabase or billing writes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  stdin: {
    contents: `import React from'react';import{createRoot}from'react-dom/client';import{AppShell}from'./components/app/app-shell';createRoot(document.getElementById('root')).render(<AppShell organizationId="example-workspace" organizations={[{id:'example-workspace',name:'Example workspace'}]} organization={{name:'Example workspace',logoUrl:null}} user={{fullName:'Jordan',email:'example@example.invalid'}} isAdmin={true} notifications={[]} notificationCount={2} pendingApprovalCount={2} needsYouCount={3} plan="premium"><h1>Example workspace</h1><p>Navigation verification only</p></AppShell>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  bundle: true,
  write: false,
  outfile: "nav.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "isolated-next",
      setup(b) {
        b.onResolve(
          { filter: /^next\/(link|image|navigation|dynamic)$/ },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "js",
          resolveDir: process.cwd(),
          contents: a.path.endsWith("/link")
            ? `import React from'react';export default function Link({children,prefetch,...props}){return React.createElement('a',{...props,onClick:e=>{props.onClick?.(e);e.preventDefault();window.testPath=props.href;window.dispatchEvent(new Event('test-route'))}},children)}`
            : a.path.endsWith("/image")
              ? `import React from'react';export default function Image({priority,fill,quality,...props}){return React.createElement('img',props)}`
              : a.path.endsWith("/dynamic")
                ? `export default function dynamic(){return ()=>null}`
                : `import{useState,useEffect}from'react';export function usePathname(){const[p,s]=useState(window.testPath||'/app');useEffect(()=>{const f=()=>s(window.testPath);window.addEventListener('test-route',f);return()=>window.removeEventListener('test-route',f)},[]);return p}export const useRouter=()=>({refresh(){},push(){}});export const useSearchParams=()=>new URLSearchParams();`,
        }));
      },
    },
  ],
});
const css = readdirSync(".next/static/css")
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(`.next/static/css/${f}`, "utf8"))
  .join("\n");
const server = createServer((req, res) => {
  if (req.url === "/nav.js") {
    res.setHeader("content-type", "application/javascript");
    res.end(bundle.outputFiles.find((f) => f.path.endsWith(".js")).text);
    return;
  }
  if (
    /^\/[a-zA-Z0-9_./-]+\.(png|svg|webp)$/.test(req.url ?? "") &&
    !(req.url ?? "").includes("..") &&
    existsSync(`public${req.url}`)
  ) {
    res.setHeader(
      "content-type",
      req.url.endsWith(".svg") ? "image/svg+xml" : "image/png",
    );
    res.end(readFileSync(`public${req.url}`));
    return;
  }
  res.setHeader("content-type", "text/html");
  res.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${bundle.outputFiles.find((f) => f.path.endsWith(".css")).text}</style></head><body><div id="root"></div><script src="/nav.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
mkdirSync("artifacts/opryn-icons", { recursive: true });
const browser = await chromium.launch();
let checks = 0;
try {
  for (const width of [390, 768, 1440])
    for (const reduced of [false, true]) {
      const page = await browser.newPage({
        viewport: { width, height: 960 },
        reducedMotion: reduced ? "reduce" : "no-preference",
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/**", (r) => r.fulfill({ json: {} }));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      if (width < 1024)
        await page
          .getByRole("button", { name: "Open menu", exact: true })
          .click();
      const nav = page.getByRole("navigation", {
        name: width < 1024 ? "Mobile navigation" : "Application navigation",
        exact: true,
      });
      await expect(nav).toBeVisible();
      for (const [label, name] of [
        ["Home", "home"],
        ["Ask Opryn", "ask"],
        ["Teach Opryn", "teach"],
        ["Knowledge", "knowledge"],
        ["Needs You", "needs-you"],
        ["Team", "team"],
        ["Connections", "connections"],
        ["Settings", "settings"],
      ]) {
        const row = nav.getByRole("link", { name: label, exact: false });
        await expect(
          row.locator(`[data-opryn-icon="${name}"] img`),
        ).toBeVisible();
        checks++;
      }
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `artifacts/opryn-icons/navigation-${width}${reduced ? "-reduced" : ""}.png`,
        fullPage: true,
      });
      if (width === 1440) {
        const ask = nav.getByRole("link", { name: "Ask Opryn", exact: true });
        await ask.focus();
        await expect(ask.locator("[data-opryn-icon]")).toHaveAttribute(
          "data-icon-state",
          "hover",
        );
        await ask.click();
        await expect(ask).toHaveAttribute("aria-current", "page");
        await expect(nav.locator(".opryn-nav-active")).toHaveCount(1);
        checks += 3;
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.deepEqual(errors, []);
      checks += 2;
      await page.close();
    }
  console.log(`PASS: ${checks} actual AppShell navigation checks.`);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
