// Read-only. Never print keys, price IDs, customer records, or environment values.
import Stripe from "stripe";
for (const [provider, keys] of Object.entries({
  Slack: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "SLACK_SIGNING_SECRET"],
  Teams: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
  Email: ["RESEND_API_KEY"],
}))
  console.log(provider, {
    configured: keys.every((key) => Boolean(process.env[key])),
  });
if (!process.env.STRIPE_SECRET_KEY) {
  console.log("Stripe not configured");
  process.exit(0);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
for (const plan of ["CORE", "PREMIUM"])
  for (const interval of ["MONTHLY", "ANNUAL"]) {
    const id = process.env[`STRIPE_${plan}_${interval}_PRICE_ID`];
    if (!id) {
      console.log(plan, interval, "not configured");
      continue;
    }
    const price = await stripe.prices.retrieve(id);
    console.log(plan, interval, {
      active: price.active,
      live: price.livemode,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
    });
  }
