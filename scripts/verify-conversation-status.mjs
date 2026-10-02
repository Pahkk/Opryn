// Actual route handlers with explicit auth/database doubles; never contacts Supabase.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let calls = [];
let subscriptionPlan = "premium";
globalThis.__conversationContext = {
  supabase: {
    from(table) {
      const filters = [];
      calls.push({ table, filters });
      const chain = {};
      for (const method of [
        "select",
        "eq",
        "is",
        "in",
        "gte",
        "order",
        "limit",
        "upsert",
        "insert",
      ])
        chain[method] = (...args) => {
          filters.push([method, ...args]);
          return chain;
        };
      chain.maybeSingle = () =>
        Promise.resolve({
          data:
            table === "organization_subscriptions"
              ? {
                  plan: subscriptionPlan,
                  status: "active",
                  stripe_subscription_id: "sub_test",
                }
              : table === "external_learning_jobs"
                ? null
                : table === "onboarding_learning_sessions"
                  ? { intent: null }
                  : null,
          error: null,
        });
      chain.then = (resolve) =>
        Promise.resolve({ data: [], error: null }).then(resolve);
      return chain;
    },
  },
  membership: { organization_id: "org-a" },
  user: { id: "user-a" },
};
async function load(entry) {
  const bundle = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    alias: { "@": process.cwd() },
    plugins: [
      {
        name: "auth-double",
        setup(b) {
          b.onResolve({ filter: /^@\/lib\/api$/ }, () => ({
            path: "context",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            contents:
              "export async function getRequestContext(){return globalThis.__conversationContext}",
            loader: "js",
          }));
        },
      },
    ],
  });
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    (name) => name === "server-only" ? {} : require(name),
    fixtureModule,
    fixtureModule.exports,
  );
  return fixtureModule.exports;
}
const status = await load("app/api/onboarding/ai-connections/status/route.ts");
let response = await status.GET(
  new Request(
    "https://opryn.test/api/onboarding/ai-connections/status?provider=chatgpt&name=Refunds&since=2026-09-16T00:00:00.000Z",
  ),
);
assert.equal(response.status, 200);
const job = calls.find((call) => call.table === "external_learning_jobs");
assert.ok(
  job.filters.some(
    ([m, k, v]) => m === "eq" && k === "organization_id" && v === "org-a",
  ),
);
assert.ok(
  job.filters.some(
    ([m, k, v]) => m === "eq" && k === "created_by" && v === "user-a",
  ),
);
assert.ok(
  job.filters.some(
    ([m, k, v]) => m === "eq" && k === "client_kind" && v === "chatgpt",
  ),
);
assert.ok(
  job.filters.findIndex(([m, k]) => m === "eq" && k === "name") <
    job.filters.findIndex(([m]) => m === "limit"),
);
assert.ok(
  job.filters.some(([m, k]) => m === "gte" && k === "last_requested_at"),
);
assert.ok(
  !job.filters.some((args) => JSON.stringify(args).includes("context_text")),
);
for (const query of [
  "provider=slack",
  "provider=claude&since=invalid",
  "provider=chatgpt&name=",
])
  assert.equal(
    (
      await status.GET(
        new Request(
          `https://opryn.test/api/onboarding/ai-connections/status?${query}`,
        ),
      )
    ).status,
    400,
  );
const session = await load("app/api/onboarding/learning-session/route.ts");
const forged = "40000000-0000-4000-8000-000000000099";
response = await session.POST(
  new Request("https://opryn.test/api/onboarding/learning-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      intent: {
        provider: "chatgpt",
        type: "general",
        name: "Business notes",
        stage: "request",
        requestId: forged,
        expiresAt: "2099-01-01T00:00:00.000Z",
        jobId: forged,
      },
    }),
  }),
);
assert.equal(response.status, 200);
const issued = (await response.json()).intent;
assert.notEqual(
  issued.requestId,
  forged,
  "request ID is always issued by server",
);
assert.equal(issued.jobId, undefined, "client cannot attach a job");
assert.ok(
  Date.parse(issued.expiresAt) <= Date.now() + 1801000,
  "bounded server expiry",
);
assert.equal(
  (
    await status.GET(
      new Request(`https://opryn.test/?provider=chatgpt&requestId=${forged}`),
    )
  ).status,
  400,
  "unknown request cannot be associated",
);
response = await session.POST(
  new Request("https://opryn.test/api/onboarding/learning-session", {
    method: "POST",
    headers: {
      origin: "https://evil.test",
      "content-type": "application/json",
    },
    body: "{}",
  }),
);
assert.equal(response.status, 403);
response = await session.POST(
  new Request("https://opryn.test/api/onboarding/learning-session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      intent: {
        provider: "claude",
        type: "history_scan",
        name: "Private",
        stage: "waiting",
      },
    }),
  }),
);
assert.equal(response.status, 400);
subscriptionPlan = "core";
response = await session.POST(new Request("https://opryn.test/api/onboarding/learning-session", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ intent: { provider: "claude", type: "business", name: "Acme", stage: "request" } }),
}));
assert.equal(response.status, 403);
assert.equal((await response.json()).code, "premium_required");
response = await status.GET(new Request("https://opryn.test/?provider=claude"));
assert.equal((await response.json()).entitlement.enabled, false);
globalThis.__conversationContext = {
  error: new Response(null, { status: 401 }),
};
assert.equal(
  (await status.GET(new Request("https://opryn.test/?provider=claude"))).status,
  401,
);
globalThis.__conversationContext = {
  error: new Response(null, { status: 403 }),
};
assert.equal((await session.GET()).status, 403);
console.log(
  "PASS conversation routes: tenant/user/provider filters; intent name and time filter before limit; no raw context; invalid requests; cross-origin rejection; auth failures (explicit doubles)",
);
