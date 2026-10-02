// SSR + real browser hydration of the actual dashboard component; no data/API writes.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const props = {
  answeredCount: 1,
  askedCount: 3,
  handledRate: 33,
  needsYou: 5,
  approvedCount: 6,
  reviewCount: 2,
  returnedTime: null,
  nextAction: {
    label: "Needs your decision",
    title: "5 items waiting",
    description: "Review decisions.",
    href: "/app/needs-you",
  },
};
const plugins = [
  {
    name: "router-fixture",
    setup(b) {
      b.onResolve({ filter: /^next\/(navigation|link)$/ }, (a) => ({
        path: a.path,
        namespace: "fixture",
      }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
        contents: a.path.endsWith("navigation")
          ? "const router={refresh(){}};export const useRouter=()=>router"
          : 'import React from"react";export default function Link(p){return React.createElement("a",p,p.children)}',
        loader: "js",
        resolveDir: process.cwd(),
      }));
    },
  },
];
const common = {
  bundle: true,
  write: false,
  jsx: "automatic",
  alias: { "@": process.cwd() },
  plugins,
};
const serverBundle = await build({
  ...common,
  stdin: {
    contents: `import React from'react';import{renderToString}from'react-dom/server';import{DashboardPulse}from'./components/app/dashboard-pulse';export const html=renderToString(<DashboardPulse {...${JSON.stringify(props)}}/>);`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  format: "cjs",
  platform: "node",
});
const serverModule = { exports: {} };
new Function("module", "exports", "require", serverBundle.outputFiles[0].text)(
  serverModule,
  serverModule.exports,
  createRequire(import.meta.url),
);
const { html } = serverModule.exports;
assert.ok(html.includes("Live workspace"));
assert.equal(html.includes("Updated "), false);
const client = await build({
  ...common,
  stdin: {
    contents: `import React from'react';import{hydrateRoot}from'react-dom/client';import{DashboardPulse}from'./components/app/dashboard-pulse';window.hydrationErrors=[];hydrateRoot(document.getElementById('root'),<DashboardPulse {...${JSON.stringify(props)}}/>,{onRecoverableError:e=>window.hydrationErrors.push(e.message)});`,
    resolveDir: process.cwd(),
    loader: "jsx",
  },
  format: "iife",
  platform: "browser",
});
const server = createServer((req, res) => {
  res.setHeader(
    "content-type",
    req.url === "/client.js" ? "text/javascript" : "text/html",
  );
  res.end(
    req.url === "/client.js"
      ? client.outputFiles[0].text
      : `<html><body><div id="root">${html}</div><script src="/client.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
try {
  for (const timezoneId of ["America/Los_Angeles", "Asia/Tokyo"]) {
    const context = await browser.newContext({ timezoneId });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByText(/^Updated /).waitFor();
    assert.deepEqual(await page.evaluate(() => window.hydrationErrors), []);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "PASS: actual DashboardPulse SSR/hydration across Los Angeles/Tokyo browser time zones; stable initial clock label, live local timestamp after hydration, no recoverable or page errors.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
