import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

if (!process.env.OPRYN_ESBUILD_MODULE)
  throw new Error(
    "Set OPRYN_ESBUILD_MODULE to a temporary esbuild installation.",
  );
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const root = resolve(new URL("..", import.meta.url).pathname);
const result = await build({
  entryPoints: [resolve(root, "scripts/product-ui-fixture.jsx")],
  bundle: true,
  write: false,
  outfile: "fixture.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"development"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://example.supabase.co"',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY":
      '"fixture-not-a-credential"',
  },
  alias: { "@": root },
  plugins: [
    {
      name: "explicit-test-router",
      setup(builder) {
        builder.onResolve({ filter: /^@nangohq\/frontend$/ }, () => ({
          path: "nango-test-double",
          namespace: "nango-test",
        }));
        builder.onLoad({ filter: /.*/, namespace: "nango-test" }, () => ({
          loader: "js",
          contents: `export class AuthError extends Error { constructor(message,type){super(message);this.type=type;} } export default class Nango { constructor({connectSessionToken}={}) { window.nangoTestTokenReceived=Boolean(connectSessionToken); } auth(){ return new Promise((resolve,reject)=>{ window.nangoTestResolve=resolve; window.nangoTestReject=reject; }); } reconnect(){ return this.auth(); } clear(){} }`,
        }));
        builder.onResolve(
          { filter: /^next\/(navigation|link|image)$/ },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          loader: "jsx",
          resolveDir: root,
          contents: args.path.endsWith("navigation")
            ? `export const usePathname=()=>({knowledge:'/app/processes','teach-google':'/app/processes/new',ask:'/app/ask',needs:'/app/needs-you',integrations:'/app/integrations',process:'/app/processes/new',learning:'/app/training',sources:'/app/processes/new',welcome:'/app'}[new URLSearchParams(location.search).get('screen')??'ask'] ?? '/app'); export const useRouter=()=>({refresh:()=>{window.fixtureRefreshes=(window.fixtureRefreshes??0)+1},push:()=>{},replace:()=>{},back:()=>{}}); export const useSearchParams=()=>new URLSearchParams(location.search);`
            : args.path.endsWith("image")
              ? `import React from 'react'; export default function Image({src,alt,fill,unoptimized,priority,...props}) { return <img src={src} alt={alt} style={fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:undefined} {...props}/> }`
              : `import React from 'react'; export default function Link({children,prefetch,...props}) {return <a {...props}>{children}</a>}`,
        }));
      },
    },
  ],
});
const cssDirectory = resolve(root, ".next/static/css");
const css = readdirSync(cssDirectory)
  .filter((n) => n.endsWith(".css"))
  .map((n) => readFileSync(resolve(cssDirectory, n), "utf8"))
  .join("\n");
const server = createServer((request, response) => {
  if (request.url === "/opryn-logo.png") {
    response.setHeader("Content-Type", "image/png");
    response.end(readFileSync(resolve(root, "public/opryn-logo.png")));
    return;
  }
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(
      result.outputFiles.find((file) => file.path.endsWith(".js")).text,
    );
    return;
  }
  response.setHeader("Content-Type", "text/html");
  response.end(
    `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\n${result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? ""}</style></head><body style="margin:0"><div id="root"></div><script src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const output = resolve(root, "artifacts/product-ux");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
let assertions = 0;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // This suite installs an explicit Picker double. Its preload must not load
  // Google's real SDK later and replace the double halfway through a test.
  await page.route("https://apis.google.com/js/api.js", (route) => route.abort());
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Fixture network failure. Please retry." }),
    }),
  );
  async function load(screen, width) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/?screen=${screen}`);
    await page.locator("#workspace-main").waitFor();
    await page.waitForTimeout(450);
  }
  let learningSession = { intent: null, imports: [] };
  await page.route("**/api/onboarding/learning-session", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      learningSession = { ...learningSession, intent: body.intent };
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(learningSession),
    });
  });
  for (const width of [320, 375, 390, 430, 768, 1280, 1440]) {
    for (const screen of [
      "ask",
      "needs",
      "integrations",
      "process",
      "welcome",
      "sources",
      "learning-overview",
      "team",
      "approvals",
      "knowledge",
      "teach-google",
    ]) {
      await load(screen, width);
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      if (!noOverflow) {
        console.log(
          await page.evaluate(() =>
            [...document.querySelectorAll("#workspace-main *")]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 12)
              .map((el) => ({
                tag: el.tagName,
                classes: el.className,
                right: el.getBoundingClientRect().right,
                text: el.textContent.slice(0, 60),
              })),
          ),
        );
        await page.screenshot({
          animations: "disabled",
          path: resolve(output, `overflow-${screen}-${width}.png`),
          fullPage: true,
        });
      }
      assert.ok(noOverflow, `${screen}: no overflow at ${width}px`);
      assertions++;
      if (screen === "learning-overview") {
        const metrics = await page
          .locator(".learning-summary > .opryn-metric")
          .evaluateAll((elements) =>
            elements.map((element) => {
              const box = element.getBoundingClientRect();
              const label = element
                .querySelector(".opryn-metric__label")
                .getBoundingClientRect();
              const value = element
                .querySelector(".opryn-metric__value")
                .getBoundingClientRect();
              return {
                left: label.left - box.left,
                top: label.top - box.top,
                bottom: box.bottom - value.bottom,
                gap: value.top - label.bottom,
              };
            }),
          );
        assert.equal(metrics.length, 3);
        assert.ok(
          metrics.every(
            (metric) =>
              metric.left >= 24 &&
              metric.top >= 20 &&
              metric.bottom >= 19 &&
              metric.gap >= 8,
          ),
          `Learning metrics have unclipped spacing at ${width}px`,
        );
        assertions += 2;
      }
      if (screen === "ask") {
        const input = page.getByRole("textbox", {
          name: "Your company question",
        });
        const bounds = await input.boundingBox();
        assert.ok(bounds.y < 460, `Question input visible near top: ${width}`);
        assertions++;
        if (width < 1024) {
          await page
            .getByRole("button", { name: "Open menu", exact: true })
            .click();
          const navigation = page.getByRole("dialog", {
            name: "Workspace navigation",
          });
          const panel = await navigation
            .locator(".product-sidebar")
            .boundingBox();
          assert.ok(
            panel && panel.x === 0,
            `Navigation opens on the left at ${width}px`,
          );
          if (width === 390)
            await page.screenshot({
              path: resolve(output, "navigation-left-390.png"),
              animations: "disabled",
            });
          await page
            .getByRole("button", { name: "Close menu", exact: true })
            .click();
          assert.equal(await navigation.count(), 0);
          assertions += 2;
        }
      }
      if ([375, 390, 430, 768, 1280, 1440].includes(width))
        await page.screenshot({
          animations: "disabled",
          path: resolve(output, `${screen}-${width}.png`),
          fullPage: true,
        });
    }
  }
  // Full-screen review sheet, a single scroll region, focus trap and restoration.
  await load("needs", 390);
  await page
    .getByRole("button", {
      name: "Review Client delivery process",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  assert.equal(
    await dialog.locator("input,textarea").count(),
    0,
    "A fully defined proposal must not show an empty answer form",
  );
  assertions++;
  assert.ok((await dialog.boundingBox()).y < 2, "Review begins at visible top");
  assertions++;
  await page
    .locator(".needs-you-sheet-body")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  assert.ok(
    await dialog
      .getByRole("button", { name: "Accept", exact: true })
      .isVisible(),
  );
  assertions++;
  for (let n = 0; n < 12; n++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    );
    assertions++;
  }
  await page.screenshot({
    animations: "disabled",
    path: resolve(output, "review-sheet-390.png"),
  });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", {
        name: "Review Client delivery process",
        exact: true,
      })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  assertions++;
  // The notification follows its entity link even when mark-as-read fails.
  await load("ask", 390);
  await page.getByRole("button", { name: /Open notifications/ }).click();
  const notificationDialog = page.getByRole("dialog", {
    name: "Notifications",
  });
  await notificationDialog
    .getByRole("link", { name: /Client delivery process needs review/ })
    .click();
  await page.waitForURL("**/app/needs-you?item=proposal-2");
  await page.getByRole("dialog").waitFor();
  assert.ok(
    await page
      .getByRole("dialog")
      .getByText("Client delivery process", { exact: true })
      .isVisible(),
  );
  assert.ok((await page.getByRole("dialog").boundingBox()).y < 2);
  assertions += 2;
  // Nango UI state tests: explicit SDK/API doubles, not OAuth evidence.
  let confirmed = false;
  await page.route("**/api/integrations/nango/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        route.request().method() === "GET"
          ? { attempts: [] }
          : {
              sessionToken: "fixture-session-not-a-real-token",
              attemptId: "fixture-attempt",
              integrationId: "google-workspace-fixture",
              reconnect: false,
            },
      ),
    }),
  );
  await page.route("**/api/integrations/nango/attempts/*", (route) =>
    route.fulfill({
      status: route.request().method() === "POST" && !confirmed ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: confirmed ? "confirmed" : "pending",
        connectionId: confirmed ? "fixture-connection" : null,
      }),
    }),
  );
  let selectedGoogleFiles = [];
  await page.route("**/api/integrations/nango/fixture-connection", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: "fixture-connection",
        status: "connected",
        connected_at: "2026-09-11T12:00:00Z",
        last_sync_at: null,
        capabilities: ["knowledge_import"],
        error_code: null,
        external_account_name: "alex@example.test",
        connected_by_label: "Alex Example",
        selected_files: selectedGoogleFiles,
      }),
    }),
  );
  await page.route(
    "**/api/integrations/nango/fixture-connection/picker",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "fixture-short-lived-token",
          developerKey: "fixture-picker-key",
          appId: "123456789",
        }),
      }),
  );
  await page.route(
    "**/api/integrations/nango/fixture-connection/files",
    (route) => {
      selectedGoogleFiles = [
        {
          id: "fixture-google-doc",
          name: "Refund policy",
          type: "Google Doc",
        },
      ];
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ files: selectedGoogleFiles }),
      });
    },
  );
  for (const width of [320, 375, 390, 430, 1280]) {
    await load("integrations&nango=1", width);
    await page.getByPlaceholder("Search integrations").fill("Google Workspace");
    await page
      .getByRole("option", { name: "Connect Google Workspace", exact: true })
      .click();
    const sheet = page.getByRole("dialog");
    await sheet
      .locator("button", { hasText: "Continue with Google" })
      .waitFor();
    assert.ok(
      await sheet
        .getByText("For Example workspace", { exact: true })
        .isVisible(),
    );
    assert.equal(await sheet.locator('input[type="password"]').count(), 0);
    assert.ok(
      await sheet.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    );
    await page.screenshot({
      path: resolve(output, `nango-connect-${width}.png`),
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assertions += 4;
  }
  await load("integrations&nango=1", 390);
  await page.getByPlaceholder("Search integrations").fill("Google Workspace");
  await page
    .getByRole("option", { name: "Connect Google Workspace", exact: true })
    .click();
  await page.locator("button", { hasText: "Continue with Google" }).click();
  await page.waitForFunction(() => window.nangoTestTokenReceived === true);
  await page.evaluate(() => window.nangoTestReject(new Error("closed")));
  await page
    .getByRole("alert")
    .filter({ hasText: "Google couldn’t be connected" })
    .waitFor();
  assert.equal(
    await page.getByText("Google Workspace connected", { exact: true }).count(),
    0,
  );
  await page.evaluate(() => {
    window.nangoTestTokenReceived = false;
  });
  await page.locator("button", { hasText: "Continue with Google" }).click();
  await page.waitForFunction(() => window.nangoTestTokenReceived === true);
  await page.evaluate(() =>
    window.nangoTestResolve({
      connectionId: "browser-only-untrusted",
      providerConfigKey: "google-workspace-fixture",
    }),
  );
  await page
    .getByText("Confirming Google Workspace…", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByText("Google Workspace connected", { exact: true }).count(),
    0,
  );
  confirmed = true;
  await page.getByText("Google Workspace connected", { exact: true }).waitFor();
  await page.screenshot({
    path: resolve(output, "nango-confirmed-390.png"),
    animations: "disabled",
  });
  const installPickerMock = () => {
    window.google = {
      picker: {
        Action: { PICKED: "picked", CANCEL: "cancel" },
        Response: { ACTION: "action", DOCUMENTS: "documents" },
        ViewId: { DOCS: "docs" },
        Feature: {
          MULTISELECT_ENABLED: "multiselect",
          SUPPORT_DRIVES: "shared-drives",
        },
        DocsView: class {
          setIncludeFolders() {
            return this;
          }
          setSelectFolderEnabled() {
            return this;
          }
          setMimeTypes() {
            return this;
          }
        },
        PickerBuilder: class {
          addView() {
            return this;
          }
          enableFeature() {
            return this;
          }
          setOAuthToken() {
            return this;
          }
          setDeveloperKey() {
            return this;
          }
          setAppId() {
            return this;
          }
          setOrigin() {
            return this;
          }
          setCallback(callback) {
            window.fixturePickerCallback = callback;
            return this;
          }
          build() {
            return {
              dispose() {
                window.fixturePickerVisible = false;
              },
              setVisible(value) {
                window.fixturePickerVisible = value;
                window.fixtureHostDialogOpenWhenPickerOpened =
                  document.querySelector("dialog")?.open ?? false;
              },
            };
          }
        },
      },
    };
  };
  await page.evaluate(installPickerMock);
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await page.waitForFunction(() => window.fixturePickerVisible === true);
  assert.equal(
    await page.evaluate(() => window.fixtureHostDialogOpenWhenPickerOpened),
    false,
    "Google Picker must not be hidden behind Opryn's native dialog",
  );
  await page.evaluate(() => window.fixturePickerCallback({ action: "cancel" }));
  await page.waitForFunction(() => document.querySelector("dialog")?.open);
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await page.evaluate(() =>
    window.fixturePickerCallback({
      action: "picked",
      documents: [{ id: "fixture-google-doc" }],
    }),
  );
  await page
    .getByRole("button", { name: "Learn from these files", exact: true })
    .waitFor();
  assert.ok(
    await page.getByText("Refund policy", { exact: true }).isVisible(),
    "Selected Google files must lead directly to the Teach Opryn action",
  );
  assertions += 5;
  // Teach never navigates through Connections. Every Google interaction below
  // uses explicit SDK/HTTP doubles; the real consent screen is not simulated as proof.
  await page.addInitScript(installPickerMock);
  let capabilityConnected = true;
  await page.route("**/api/integrations/capability?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        connectionId: capabilityConnected ? "fixture-connection" : null,
      }),
    }),
  );
  await page.route(
    "**/api/integrations/nango/fixture-connection/import",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ processId: "fixture-process" }),
      }),
  );
  for (const width of [375, 390, 430, 1440]) {
    await load("teach-google", width);
    await page
      .getByRole("button", { name: "Google Workspace", exact: true })
      .click();
    await page.waitForFunction(() => window.fixturePickerVisible === true);
    assert.ok(page.url().includes("screen=teach-google"));
    assert.equal(await page.getByRole("dialog").count(), 0);
    await page.evaluate(() =>
      window.fixturePickerCallback({
        action: "picked",
        documents: [{ id: "fixture-google-doc" }],
      }),
    );
    await page
      .getByRole("button", { name: "Learn from these files", exact: true })
      .click();
    await page
      .getByRole("link", { name: "Review findings", exact: true })
      .waitFor();
    assert.ok(
      (
        await page
          .getByRole("link", { name: "Review findings", exact: true })
          .getAttribute("href")
      ).startsWith("/app/processes/fixture-process"),
    );
    assert.ok(
      await page
        .getByText("Your findings are ready to review.", { exact: false })
        .isVisible(),
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: resolve(output, `teach-google-selected-${width}.png`),
      fullPage: true,
    });
    assertions += 4;
  }
  capabilityConnected = false;
  await load("teach-google", 390);
  await page
    .getByRole("button", { name: "Google Workspace", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await page.waitForFunction(() => window.nangoTestResolve);
  await page.evaluate(() =>
    window.nangoTestResolve({
      connectionId: "browser-only-untrusted",
      providerConfigKey: "google-workspace-fixture",
    }),
  );
  await page.waitForFunction(() => window.fixturePickerVisible === true);
  assert.equal(
    await page.getByRole("dialog").count(),
    0,
    "OAuth sheet closes before contextual Picker",
  );
  assert.ok(page.url().includes("screen=teach-google"));
  await page.evaluate(() => window.fixturePickerCallback({ action: "cancel" }));
  capabilityConnected = true;
  await page.evaluate(() =>
    sessionStorage.setItem(
      "opryn:teach-google:fixture-org",
      location.pathname + location.search,
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.fixturePickerVisible === true);
  assert.equal(
    await page.evaluate(() =>
      sessionStorage.getItem("opryn:teach-google:fixture-org"),
    ),
    null,
  );
  assertions += 3;

  // Library drawers, mobile category navigation, filters, guarded metadata edits.
  await page.route("**/api/knowledge-library/metadata", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ revision: 2 }),
    }),
  );
  for (const width of [375, 390, 430, 1440]) {
    await load("knowledge", width);
    if (width < 768) {
      await page
        .getByRole("button", { name: "All Knowledge ↓", exact: true })
        .click();
      const categories = page.getByRole("dialog", {
        name: "Choose knowledge category",
      });
      await categories
        .getByRole("navigation", { name: "Knowledge categories" })
        .waitFor();
      assert.equal(
        await categories.locator('a[href*="category=policy"]').count(),
        1,
      );
      await page.screenshot({
        path: resolve(output, `knowledge-categories-${width}.png`),
      });
      await categories
        .getByRole("button", { name: "Close", exact: true })
        .click();
      assertions++;
    }
    await page
      .getByRole("button", { name: "Filters", exact: true })
      .filter({ visible: true })
      .click();
    await page.screenshot({
      path: resolve(output, `knowledge-filters-${width}.png`),
    });
    await page
      .getByRole("dialog")
      .getByLabel("Status", { exact: true })
      .selectOption("needs_review");
    await page
      .getByRole("dialog")
      .getByLabel("Source", { exact: true })
      .selectOption("Google Workspace");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    const row = page
      .locator(".library-row")
      .filter({ hasText: "Refund approval limits" });
    assert.equal(
      await row.count(),
      2,
      "Overview and Most Used reference the same item",
    );
    await row.first().click();
    const detail = page.getByRole("dialog", { name: "Refund approval limits" });
    await detail
      .getByLabel("Tags", { exact: true })
      .fill("Refunds, Finance, Support");
    await detail
      .getByRole("button", { name: "Save classification", exact: true })
      .click();
    await detail.getByText("Classification saved.", { exact: true }).waitFor();
    assert.equal(
      await detail
        .getByRole("link", { name: "Open original source ↗" })
        .count(),
      1,
    );
    await page.screenshot({
      path: resolve(output, `knowledge-detail-${width}.png`),
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    assertions += 3;
  }
  await page.screenshot({
    animations: "disabled",
    path: resolve(output, "notification-review-390.png"),
  });
  // A stale acceptance must include the reviewed revision and retain the item.
  await load("needs", 390);
  let sent;
  await page.route("**/api/knowledge-proposals/1/approve", (route) => {
    sent = route.request().postDataJSON();
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "This proposal changed. Review the latest revision.",
      }),
    });
  });
  await page
    .locator(".needs-you-card")
    .first()
    .getByRole("button", { name: "Accept", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "This proposal changed. Review the latest revision." })
    .waitFor();
  assert.equal(sent.version, 2);
  assert.equal(sent.updatedAt, "2026-09-08T12:00:00Z");
  assert.equal(await page.locator(".needs-you-card").count(), 2);
  assertions += 3;
  // Search uses actual registry and accessible actions. Authorization isn't a test.
  await load("integrations", 390);
  const search = page.getByPlaceholder(/Search/).first();
  await search.fill("Slack");
  await page
    .getByRole("option", { name: "Connect Slack", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    animations: "disabled",
    path: resolve(output, "integration-sheet-390.png"),
  });
  assert.ok(
    await page
      .getByRole("dialog")
      .getByText("Example workspace", { exact: true })
      .isVisible(),
  );
  assertions++;
  await page.keyboard.press("Escape");
  await search.fill("ChatGPT");
  assert.match(
    await page.getByRole("option", { name: "Manage ChatGPT" }).textContent(),
    /Authorized/,
  );
  assertions++;
  await search.fill("Nonexistent fixture software");
  assert.ok(
    await page.getByText("No integration found.", { exact: true }).isVisible(),
  );
  assertions++;
  await search.fill("HubSpot");
  assert.ok(
    await page
      .getByRole("option", { name: "Request HubSpot", exact: true })
      .isVisible(),
    "Unsupported providers must be request-only, not advertised as connectable",
  );
  await search.fill("GitHub");
  assert.match(
    await page.getByRole("option", { name: "Manage GitHub" }).textContent(),
    /Setup saved · Not verified/,
  );
  assertions += 2;
  // Failed Ask and learning completion retain work, without a false success.
  await load("ask", 390);
  await page
    .getByRole("textbox", { name: "Your company question" })
    .fill("How do revisions work?");
  await page.getByRole("button", { name: "Ask Opryn", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Fixture network failure. Please retry." })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Your company question" })
      .inputValue(),
    "How do revisions work?",
  );
  assertions++;
  await page.goto(`${base}/?screen=learning&employee=1`);
  await page.getByRole("button", { name: "Mark Complete" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Your progress wasn't saved" })
    .waitFor();
  assert.equal(await page.getByText("Completed", { exact: true }).count(), 0);
  assertions++;
  await load("sources", 390);
  await page
    .getByRole("button", { name: "Learn from ChatGPT", exact: true })
    .click();
  await page.getByRole("button", { name: /My Business/ }).click();
  assert.equal(
    await page.getByLabel("Business name", { exact: true }).inputValue(),
    "Example workspace",
  );
  assertions++;
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Open ChatGPT", exact: true })
    .waitFor();
  assert.ok(
    await page
      .getByText("@Opryn /learn Example workspace", { exact: true })
      .isVisible(),
  );
  assertions++;
  await page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/onboarding/learning-session") &&
      response.request().method() === "POST",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Open ChatGPT", exact: true })
    .waitFor();
  assertions++;
  await page.screenshot({
    animations: "disabled",
    path: resolve(output, "learning-request-390.png"),
    fullPage: true,
  });
  await load("process", 390);
  await page
    .getByRole("button", { name: "Move down", exact: true })
    .first()
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Step 1 title", exact: true })
      .inputValue(),
    "Schedule a kickoff",
  );
  assertions++;
  await page.route("**/api/processes/fixture-process", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page.route("**/api/processes/fixture-process/approve", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true}',
    }),
  );
  await page
    .getByRole("button", { name: "Accept Process", exact: true })
    .click();
  await page.getByRole("heading", { name: "Approved", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Save Draft" }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Accept Process" }).count(),
    0,
  );
  assertions += 2;
  await page.screenshot({
    animations: "disabled",
    path: resolve(output, "process-accepted-390.png"),
  });
  // Reduced-motion users retain the same usable review sheet.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load("needs", 390);
  await page
    .getByRole("button", {
      name: "Review Client delivery process",
      exact: true,
    })
    .click();
  assert.ok(
    parseFloat(
      await page
        .locator(".needs-you-sheet")
        .evaluate((el) => getComputedStyle(el).animationDuration),
    ) < 0.01,
  );
  assertions++;
  // Real shared upload components; only server responses are mocked.
  learningSession = { intent: null, imports: [] };
  for (const width of [390, 1280]) {
    for (const screen of ["sources", "teach-files"]) {
      await load(screen, width);
      if (screen === "sources")
        await page.getByRole("button", { name: "Upload", exact: true }).click();
      const picker = page.locator('input[type="file"]');
      assert.match(
        await picker.getAttribute("accept"),
        /\.png.*\.jpeg.*\.docx.*\.doc/,
      );
      await picker.setInputFiles({
        name: "invalid.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("bad"),
      });
      await page.getByRole("alert").waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Try Again" }).isEnabled(),
        false,
      );
      await picker.setInputFiles([
        {
          name: "policy.png",
          mimeType: "image/png",
          buffer: Buffer.from("89504e470d0a1a0a", "hex"),
        },
        {
          name: "guide.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: Buffer.from("504b0304", "hex"),
        },
      ]);
      let calls = 0;
      await page.route("**/api/processes/import", (route) => {
        calls++;
        assert.match(
          route.request().headers()["content-type"],
          /multipart\/form-data/,
        );
        const failed = calls === 2;
        return route.fulfill({
          status: failed ? 503 : 200,
          contentType: "application/json",
          body: JSON.stringify(
            failed
              ? { error: "Fixture: try the Word file again." }
              : { ready: true, processId: `import-${calls}` },
          ),
        });
      });
      await page
        .getByRole("button", { name: "Start Learning", exact: true })
        .click();
      await page.getByRole("alert").waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Review Findings" }).count(),
        1,
      );
      await page
        .getByRole("button", { name: "Try Again", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Your findings are ready." })
        .waitFor();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('a[href*="/app/processes/import-"]')
            .length === 2,
      );
      assert.equal(calls, 3, "Completed first file is not uploaded again");
      const expectedReturn =
        screen === "sources" ? "/onboarding?step=teach" : "/app/processes";
      for (const link of await page
        .getByRole("link", { name: "Review Findings" })
        .all()) {
        assert.ok(
          (await link.getAttribute("href")).includes(
            encodeURIComponent(expectedReturn),
          ),
        );
      }
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: resolve(output, `file-learning-${screen}-${width}.png`),
        fullPage: true,
      });
      await page.unroute("**/api/processes/import");
      assertions += 7;
    }
  }
  assert.deepEqual(errors, [], "No client exceptions");
  console.log(
    `Passed ${assertions} browser component assertions at 320/375/390/430/768/1280/1440px. Screenshots: ${output}. Explicit fixtures, not live authenticated integration evidence.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
