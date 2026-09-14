import { NextResponse } from "next/server";
import { apiError, getRequestContext } from "@/lib/api";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { getAppUrl, getStripe } from "@/lib/billing/stripe";
import { rejectCrossOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
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
    if (!subscription.stripeCustomerId)
      return NextResponse.json(
        { error: "No Stripe billing account exists for this workspace yet." },
        { status: 404 },
      );
    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${getAppUrl()}/app/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't open subscription management. Please try again.",
    );
  }
}
