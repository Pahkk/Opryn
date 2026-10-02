import "server-only";

import Stripe from "stripe";
import { PLAN_DETAILS, type BillingInterval, type PlanId } from "@/lib/billing/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Stripe billing is not configured.");
  stripeClient ??= new Stripe(secretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return stripeClient;
}

export function getStripePriceId(plan: PlanId, interval: BillingInterval) {
  const key = `STRIPE_${plan.toUpperCase()}_${interval === "year" ? "ANNUAL" : "MONTHLY"}_PRICE_ID`;
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${plan} ${interval} billing is not configured.`);
  return value;
}

/** Fail closed while Stripe still points at historical public prices. */
export function isCurrentMonthlyPrice(price: Stripe.Price, plan: PlanId) {
  return (
    price.active &&
    price.currency === "usd" &&
    price.type === "recurring" &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.unit_amount === PLAN_DETAILS[plan].monthlyPrice * 100
  );
}

export function planFromStripePrice(priceId: string | null | undefined): {
  plan: PlanId;
  interval: BillingInterval;
} | null {
  if (!priceId) return null;
  const mappings: Array<{
    id: string | undefined;
    plan: PlanId;
    interval: BillingInterval;
  }> = [
    {
      id: process.env.STRIPE_CORE_MONTHLY_PRICE_ID,
      plan: "core",
      interval: "month",
    },
    {
      id: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      plan: "premium",
      interval: "month",
    },
    {
      id: process.env.STRIPE_CORE_ANNUAL_PRICE_ID,
      plan: "core",
      interval: "year",
    },
    {
      id: process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID,
      plan: "premium",
      interval: "year",
    },
  ];
  // Keep historical subscriptions recognizable after the current env vars
  // move to new immutable Stripe Prices. These IDs are never used by checkout.
  for (const [plan, interval, variable] of [
    ["core", "month", "STRIPE_LEGACY_CORE_MONTHLY_PRICE_IDS"],
    ["premium", "month", "STRIPE_LEGACY_PREMIUM_MONTHLY_PRICE_IDS"],
    ["core", "year", "STRIPE_LEGACY_CORE_ANNUAL_PRICE_IDS"],
    ["premium", "year", "STRIPE_LEGACY_PREMIUM_ANNUAL_PRICE_IDS"],
  ] as const) {
    for (const id of (process.env[variable] ?? "").split(",")) {
      if (id.trim()) mappings.push({ id: id.trim(), plan, interval });
    }
  }
  const match = mappings.find((item) => item.id?.trim() === priceId);
  return match ? { plan: match.plan, interval: match.interval } : null;
}

export function annualBillingConfigured() {
  return Boolean(
    process.env.STRIPE_CORE_ANNUAL_PRICE_ID?.trim() &&
    process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim(),
  );
}

export function billingConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
    process.env.STRIPE_CORE_MONTHLY_PRICE_ID?.trim() &&
    process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID?.trim(),
  );
}

export async function currentMonthlyBillingReady() {
  if (!billingConfigured()) return false;
  try {
    const stripe = getStripe();
    const [starter, pro] = await Promise.all([
      stripe.prices.retrieve(getStripePriceId("core", "month")),
      stripe.prices.retrieve(getStripePriceId("premium", "month")),
    ]);
    return isCurrentMonthlyPrice(starter, "core") &&
      isCurrentMonthlyPrice(pro, "premium");
  } catch {
    return false;
  }
}

export function getAppUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;
  return "http://localhost:3000";
}
