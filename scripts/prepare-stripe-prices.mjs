// Explicit, idempotent Stripe price preparation. Dry-run by default.
// Run only with the intended account's STRIPE_SECRET_KEY and --mode=test|live.
// --apply creates missing Prices, but never edits subscriptions or old Prices.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY?.trim();
const mode = key?.startsWith("sk_test_") || key?.startsWith("rk_test_")
  ? "test"
  : key?.startsWith("sk_live_") || key?.startsWith("rk_live_")
    ? "live"
    : null;
const requestedMode = process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1];
const apply = process.argv.includes("--apply");
if (!mode || requestedMode !== mode) {
  console.error("A valid Stripe key and matching --mode=test|live are required.");
  process.exitCode = 1;
} else {
  const stripe = new Stripe(key, { timeout: 20_000, maxNetworkRetries: 1 });
  const plans = [
    { key: "starter", oldVariable: "STRIPE_CORE_MONTHLY_PRICE_ID", amount: 4900 },
    { key: "pro", oldVariable: "STRIPE_PREMIUM_MONTHLY_PRICE_ID", amount: 12900 },
  ];
  console.log(`Stripe mode: ${mode}; operation: ${apply ? "create missing Prices" : "dry run"}`);
  const active = await stripe.subscriptions.list({ status: "active", limit: 1 });
  const trialing = await stripe.subscriptions.list({ status: "trialing", limit: 1 });
  console.log("Active subscribers present:", active.data.length > 0);
  console.log("Trialing subscribers present:", trialing.data.length > 0);
  console.log("Counts above are existence checks, not account-wide totals.");
  for (const plan of plans) {
    const oldId = process.env[plan.oldVariable]?.trim();
    if (!oldId) throw new Error(`${plan.oldVariable} is required to identify the existing Product.`);
    const oldPrice = await stripe.prices.retrieve(oldId, { expand: ["product"] });
    const product = oldPrice.product;
    if (typeof product !== "object" || product.deleted)
      throw new Error(`${plan.key} Product cannot be verified.`);
    if (oldPrice.livemode !== (mode === "live"))
      throw new Error(`${plan.key} Price mode does not match the requested mode.`);
    const legacyKey = plan.key === "starter" ? "core" : "premium";
    if (product.metadata?.plan_key && ![plan.key, legacyKey].includes(product.metadata.plan_key))
      throw new Error(`${plan.key} Product has conflicting plan_key metadata.`);
    if (oldPrice.currency !== "usd" || oldPrice.recurring?.interval !== "month")
      throw new Error(`${plan.key} existing Price is not USD monthly.`);
    const [prices, inactive] = await Promise.all([
      stripe.prices.list({ product: product.id, active: true, limit: 100 }),
      stripe.prices.list({ product: product.id, active: false, limit: 100 }),
    ]);
    if (prices.has_more || inactive.has_more)
      throw new Error(`${plan.key} has more than 100 Prices in one state; inspect manually.`);
    const matching = (price) =>
      price.currency === "usd" && price.recurring?.interval === "month" &&
      price.recurring.interval_count === 1 && price.unit_amount === plan.amount;
    const matches = prices.data.filter(matching);
    if (inactive.data.some(matching) && !matches.length)
      throw new Error(`${plan.key} matching Price is inactive; inspect before creating another.`);
    if (matches.length > 1) throw new Error(`${plan.key} has multiple matching Prices; inspect manually.`);
    if (apply && product.metadata?.plan_key !== plan.key)
      await stripe.products.update(product.id, {
        metadata: { ...product.metadata, plan_key: plan.key },
      });
    let current = matches[0];
    if (!current && apply) {
      current = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: plan.amount,
        recurring: { interval: "month" },
        nickname: `Opryn ${plan.key === "starter" ? "Starter" : "Pro"} monthly`,
        metadata: { plan_key: plan.key },
      }, { idempotencyKey: `opryn-${mode}-${plan.key}-${plan.amount}-monthly-v1` });
    }
    console.log(JSON.stringify({
      plan: plan.key, productId: product.id, oldPriceId: oldPrice.id,
      oldAmount: oldPrice.unit_amount, newAmount: plan.amount,
      currentPriceId: current?.id ?? null, created: Boolean(apply && !matches.length),
    }));
  }
  console.log("Old Prices and all subscriptions were left unchanged.");
  console.log("Review Customer Portal switchable Prices and proration before changing env vars.");
}
