import "server-only";
import { getStripePriceId, planFromStripePrice } from "./stripe";
export const TRIAL_DAYS = 5;
/** Preserve the existing Premium-only trial and card collection policy. */
export function trialConfiguration() {
  const priceId =
    process.env.STRIPE_TRIAL_PRICE_ID?.trim() ||
    getStripePriceId("premium", "month");
  const mapped = planFromStripePrice(priceId);
  if (!mapped)
    throw new Error("Trial price must map to a configured Opryn plan.");
  const raw = process.env.TRIAL_REQUIRES_PAYMENT_METHOD?.trim() || "true";
  if (!["true", "false"].includes(raw))
    throw new Error("Invalid trial payment configuration.");
  return {
    ...mapped,
    priceId,
    days: TRIAL_DAYS,
    requiresPaymentMethod: raw === "true",
    missingPaymentMethod: "cancel" as const,
  };
}
