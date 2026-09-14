// Read-only audit. Never print keys or customer/payment data, create products,
// subscriptions, sessions, or make charges. Safe against either Stripe mode.
import Stripe from "stripe";
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.log("STRIPE_SECRET_KEY unavailable in this environment");
  process.exit(0);
}
console.log(
  "Stripe mode:",
  key.startsWith("sk_test_") || key.startsWith("rk_test_") ? "test" : "live",
);
const stripe = new Stripe(key, { timeout: 15000, maxNetworkRetries: 0 });
for (const name of [
  "STRIPE_CORE_MONTHLY_PRICE_ID",
  "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
  "STRIPE_CORE_ANNUAL_PRICE_ID",
  "STRIPE_PREMIUM_ANNUAL_PRICE_ID",
]) {
  const id = process.env[name]?.trim();
  if (!id) {
    console.log(name, "missing");
    continue;
  }
  try {
    const p = await stripe.prices.retrieve(id, { expand: ["product"] });
    console.log(
      JSON.stringify({
        variable: name,
        priceId: p.id,
        active: p.active,
        amount: p.unit_amount,
        currency: p.currency,
        interval: p.recurring?.interval,
        product:
          typeof p.product === "object" && !p.product.deleted
            ? p.product.name
            : "unavailable",
      }),
    );
  } catch (e) {
    console.log(name, "could not verify", e.type || "API unavailable");
  }
}
console.log(
  "Webhook secret configured:",
  Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
);
try {
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  for (const h of hooks.data.filter((h) => h.url.includes("opryn.app")))
    console.log(
      JSON.stringify({
        webhook: h.url,
        status: h.status,
        events: h.enabled_events,
      }),
    );
} catch {
  console.log("Webhook dashboard configuration could not be read");
}
try {
  const portals = await stripe.billingPortal.configurations.list({ limit: 10 });
  console.log(
    "Active portal configurations:",
    portals.data
      .filter((p) => p.active)
      .map((p) => ({
        default: p.is_default,
        cancellation: p.features.subscription_cancel.enabled,
        paymentUpdate: p.features.payment_method_update.enabled,
      })),
  );
} catch {
  console.log("Portal configuration could not be read");
}
