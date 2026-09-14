import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import {
  getStripe,
  getStripePriceId,
  annualBillingConfigured,
} from "@/lib/billing/stripe";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { PLAN_DETAILS, PLAN_FEATURES, type PlanId } from "@/lib/billing/plans";
import { trialConfiguration } from "@/lib/billing/trial";

export async function GET() {
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  try {
    const subscription = await getOrganizationPlan(
      context.supabase,
      context.membership.organization_id,
    );
    const trial = trialConfiguration();
    const intervals = annualBillingConfigured()
      ? (["month", "year"] as const)
      : (["month"] as const);
    const plans = await Promise.all(
      (["core", "premium"] as PlanId[]).flatMap((plan) =>
        intervals.map(async (interval) => {
          const price = await getStripe().prices.retrieve(
            getStripePriceId(plan, interval),
          );
          if (
            !price.active ||
            price.currency !== "usd" ||
            price.type !== "recurring" ||
            price.recurring?.interval !== interval ||
            price.recurring.interval_count !== 1 ||
            price.unit_amount === null
          )
            throw new Error("Invalid configured price");
          return {
            plan,
            interval,
            name: PLAN_DETAILS[plan].name,
            amount: price.unit_amount,
            currency: price.currency,
            teamLimit: PLAN_FEATURES[plan].teamLimit,
          };
        }),
      ),
    );
    return NextResponse.json(
      {
        plans,
        trial: {
          plan: trial.plan,
          interval: trial.interval,
          days: trial.days,
          requiresPaymentMethod: trial.requiresPaymentMethod,
          eligible:
            !subscription.trialUsed &&
            !["trialing", "active"].includes(subscription.status),
        },
        status: subscription.status,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Plan details couldn't load. Your setup is saved. Please try again.",
      },
      { status: 503 },
    );
  }
}
