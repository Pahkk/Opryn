// Real schemas and checkout route; Stripe/Supabase mocked. No network or charges.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  root = process.cwd();
const mock = {
  "@/lib/api": `export async function getRequestContext(){return globalThis.fixture.context()}`,
  "@/lib/supabase/service": `export function createServiceClient(){return globalThis.fixture.db}`,
  "@/lib/billing/subscription": `export async function getOrganizationPlan(){return globalThis.fixture.subscription}`,
  "@/lib/billing/stripe": `export const getStripe=()=>globalThis.fixture.stripe;export const getAppUrl=()=>"https://opryn.test";export const getStripePriceId=(p,i)=>"price_"+p+"_"+i;export const planFromStripePrice=(id)=>id==="price_premium_month"?{plan:"premium",interval:"month"}:null;`,
};
const bundle = await build({
  stdin: {
    contents: `export { POST } from './app/api/billing/checkout/route';export * from './lib/onboarding/industries';export * from './lib/onboarding/suggestions';export { billingBoundary } from './lib/billing/access';`,
    resolveDir: root,
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { "@": root },
  plugins: [
    {
      name: "mocks",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) =>
          a.path === "./stripe" && a.importer.endsWith("trial.ts")
            ? { path: "@/lib/billing/stripe", namespace: "mock" }
            : mock[a.path] || a.path === "server-only"
              ? { path: a.path, namespace: "mock" }
              : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
          contents: mock[a.path] || "",
          loader: "js",
        }));
      },
    },
  ],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  require,
  mod,
  mod.exports,
);
const api = mod.exports;
const org = "10000000-0000-4000-8000-000000000001",
  user = "20000000-0000-4000-8000-000000000001";
let f;
function reset() {
  delete process.env.STRIPE_TRIAL_PRICE_ID;
  delete process.env.TRIAL_REQUIRES_PAYMENT_METHOD;
  f = {
    subscription: {
      trialUsed: false,
      stripeCustomerId: "cus_existing",
      status: "not_subscribed",
    },
    reservation: {
      attempt_id: "attempt1",
      fingerprint: JSON.stringify([
        "price_premium_month",
        "trial",
        "onboarding",
      ]),
      session_id: null,
    },
    calls: [],
    history: [],
    lease: true,
    state: { activation_completed_at: "2026-09-15" },
  };
  f.db = {
    from(table) {
      let action, payload;
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        single() {
          return q;
        },
        maybeSingle() {
          return q;
        },
        update(p) {
          action = "update";
          payload = p;
          return q;
        },
        then(resolve) {
          if (table === "organization_checkout" && action) {
            f.calls.push(["save", payload]);
            Object.assign(f.reservation, payload);
          }
          resolve({
            data:
              table === "organization_subscriptions"
                ? f.state
                : { organization_id: org },
            error: null,
          });
        },
      };
      return q;
    },
    async rpc() {
      return { data: f.lease ? { ...f.reservation } : null, error: null };
    },
  };
  f.context = () =>
    f.denied
      ? { error: Response.json({ error: "denied" }, { status: f.denied }) }
      : {
          supabase: f.db,
          user: { id: user },
          membership: { organization_id: org },
        };
  f.stripe = {
    customers: {
      async create(p, o) {
        f.calls.push(["customer", p, o]);
        return { id: "cus_new" };
      },
    },
    subscriptions: {
      async list() {
        return { data: f.history, has_more: false };
      },
    },
    checkout: {
      sessions: {
        async create(p, o) {
          f.calls.push(["checkout", p, o]);
          if (f.failure) throw Error("mock network failure");
          return { id: "cs_test", url: "https://checkout.stripe.com/test" };
        },
        async retrieve() {
          return {
            id: "cs_test",
            status: f.sessionStatus || "open",
            subscription: f.previousSubscription,
            url: "https://checkout.stripe.com/test",
          };
        },
        async expire(id) {
          f.calls.push(["expire", id]);
        },
      },
    },
  };
  globalThis.fixture = f;
}
const post = (
  body = { plan: "premium", intent: "trial", source: "onboarding" },
  origin = "https://opryn.test",
) =>
  api.POST(
    new Request("https://opryn.test/api/billing/checkout", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
reset();
assert.equal((await post()).status, 200);
let call = f.calls.find((c) => c[0] === "checkout")[1];
assert.equal(call.subscription_data.trial_period_days, 5);
assert.equal(call.payment_method_collection, "always");
assert.equal(call.metadata.organization_id, org);
assert.equal(call.metadata.user_id, user);
assert.match(call.success_url, /api\/billing\/return/);
assert.equal(f.calls.filter((c) => c[0] === "customer").length, 0);
assert.equal((await post()).status, 200);
assert.equal(f.calls.filter((c) => c[0] === "checkout").length, 1);
reset();
f.reservation.fingerprint = JSON.stringify([
  "price_core_month",
  "purchase",
  "onboarding",
]);
assert.equal(
  (await post({ plan: "core", intent: "purchase", source: "onboarding" }))
    .status,
  200,
);
assert.equal(
  f.calls.find((c) => c[0] === "checkout")[1].subscription_data
    .trial_period_days,
  undefined,
);
reset();
process.env.TRIAL_REQUIRES_PAYMENT_METHOD = "false";
await post();
call = f.calls.find((c) => c[0] === "checkout")[1];
assert.equal(call.payment_method_collection, "if_required");
assert.equal(
  call.subscription_data.trial_settings.end_behavior.missing_payment_method,
  "cancel",
);
reset();
f.subscription.trialUsed = true;
assert.equal((await post()).status, 409);
assert.ok(!f.calls.some((c) => c[0] === "checkout"));
reset();
f.history = [{ status: "canceled", trial_start: 123 }];
assert.equal((await post()).status, 409);
reset();
f.history = [{ status: "active", trial_start: null }];
assert.equal((await post()).status, 409);
reset();
f.reservation.session_id = "cs_old";
f.sessionStatus = "complete";
assert.equal((await post()).status, 409);
f.previousSubscription = "sub_old";
f.history = [{ id: "sub_old", status: "canceled", trial_start: null }];
assert.equal((await post()).status, 200);
reset();
f.lease = false;
assert.equal((await post()).status, 409);
reset();
f.state.activation_completed_at = null;
assert.equal((await post()).status, 409);
reset();
f.denied = 401;
assert.equal((await post()).status, 401);
reset();
f.denied = 403;
assert.equal((await post()).status, 403);
reset();
assert.equal((await post(undefined, "https://hostile.test")).status, 403);
assert.equal((await post({ plan: "invented" })).status, 400);
reset();
f.failure = true;
assert.equal((await post()).status, 503);
assert.equal(f.reservation.lease_id, null);
f.failure = false;
assert.equal((await post()).status, 200);
const creates = f.calls.filter((c) => c[0] === "checkout");
assert.deepEqual(creates[0][2], creates[1][2]);
reset();
f.subscription.stripeCustomerId = null;
await post();
assert.equal(
  f.calls.find((c) => c[0] === "customer")[2].idempotencyKey,
  `opryn-customer-${org}`,
);
assert.equal(api.searchIndustries("HVAC company")[0].id, "construction");
assert.equal(
  api.searchIndustries("we build apps for businesses")[0].id,
  "technology",
);
assert.equal(api.searchIndustries("trucking")[0].id, "logistics");
assert.equal(api.searchIndustries("mobile car detailing")[0].id, "automotive");
assert.equal(
  api.setupSuggestionSchema.safeParse({ industryId: "invented" }).success,
  false,
);
reset();
f.state = {
  onboarding_billing_required: false,
  activation_completed_at: null,
  status: "not_subscribed",
};
assert.equal(await api.billingBoundary(f.db, org), false);
f.state = {
  onboarding_billing_required: true,
  activation_completed_at: null,
  status: "not_subscribed",
};
assert.equal(await api.billingBoundary(f.db, org), false);
assert.equal(await api.billingBoundary(f.db, org, false), true);
f.state.activation_completed_at = "verified";
assert.equal(await api.billingBoundary(f.db, org), true);
f.state.status = "trialing";
f.state.stripe_subscription_id = "sub_test";
assert.equal(await api.billingBoundary(f.db, org), false);
f.state.status = "past_due";
assert.equal(await api.billingBoundary(f.db, org), true);
delete globalThis.fixture;
delete process.env.TRIAL_REQUIRES_PAYMENT_METHOD;
console.log(
  "PASS mocked checkout route: 5-day trial, immediate purchase, card/no-card, customer reuse, duplicate/lease/recovery, trial abuse, membership and origin denial; curated industry search",
);
