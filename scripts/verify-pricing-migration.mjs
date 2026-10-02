// Local contract tests. No Stripe network calls or customer mutations.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const output = await build({
  entryPoints: ["lib/billing/stripe.ts", "lib/billing/trial.ts"],
  bundle: true,
  write: false,
  outdir: "out",
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [{
    name: "server-only-stub",
    setup(builder) {
      builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "stub" }));
      builder.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "", loader: "js" }));
    },
  }],
});
const modules = output.outputFiles.map((file) => {
  const fixture = { exports: {} };
  new Function("require", "module", "exports", file.text)(require, fixture, fixture.exports);
  return fixture.exports;
});
const stripe = modules.find((module) => module.planFromStripePrice);
const trial = modules.find((module) => module.trialConfiguration);
assert.ok(stripe && trial);
const prior = { ...process.env };
try {
  process.env.STRIPE_CORE_MONTHLY_PRICE_ID = "price_new_starter";
  process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID = "price_new_pro";
  process.env.STRIPE_LEGACY_CORE_MONTHLY_PRICE_IDS = "price_old_starter";
  process.env.STRIPE_LEGACY_PREMIUM_MONTHLY_PRICE_IDS = "price_old_pro";
  delete process.env.STRIPE_TRIAL_PRICE_ID;
  assert.equal(stripe.getStripePriceId("core", "month"), "price_new_starter");
  assert.equal(stripe.getStripePriceId("premium", "month"), "price_new_pro");
  assert.deepEqual(stripe.planFromStripePrice("price_new_starter"), { plan: "core", interval: "month" });
  assert.deepEqual(stripe.planFromStripePrice("price_new_pro"), { plan: "premium", interval: "month" });
  assert.deepEqual(stripe.planFromStripePrice("price_old_starter"), { plan: "core", interval: "month" });
  assert.deepEqual(stripe.planFromStripePrice("price_old_pro"), { plan: "premium", interval: "month" });
  assert.equal(stripe.planFromStripePrice("price_arbitrary"), null);
  const valid = (amount, interval = "month") => ({
    active: true, currency: "usd", type: "recurring", unit_amount: amount,
    recurring: { interval, interval_count: 1 },
  });
  assert.equal(stripe.isCurrentMonthlyPrice(valid(4900), "core"), true);
  assert.equal(stripe.isCurrentMonthlyPrice(valid(12900), "premium"), true);
  assert.equal(stripe.isCurrentMonthlyPrice(valid(9900), "core"), false);
  assert.equal(stripe.isCurrentMonthlyPrice(valid(24900), "premium"), false);
  assert.equal(stripe.isCurrentMonthlyPrice(valid(4900, "year"), "core"), false);
  assert.equal(trial.trialConfiguration().days, 5);
  assert.equal(trial.trialConfiguration().priceId, "price_new_pro");
  console.log("PASS current + legacy mapping, exact USD monthly amount guard, five-day Pro trial");
} finally {
  process.env = prior;
}
