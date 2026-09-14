import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { getOrganizationPlan } from "@/lib/billing/subscription";
export async function GET() {
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  try {
    const state = await getOrganizationPlan(
      context.supabase,
      context.membership.organization_id,
    );
    const verified =
      !!state.stripeSubscriptionId &&
      ["trialing", "active"].includes(state.status);
    return NextResponse.json(
      {
        verified,
        status: state.status,
        plan: state.subscribedPlan,
        trialEnd: state.trialEnd,
        cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        currentPeriodEnd: state.currentPeriodEnd,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Subscription status couldn't load. Retry without starting another checkout.",
      },
      { status: 503 },
    );
  }
}
