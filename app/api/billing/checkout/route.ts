import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getRequestContext } from "@/lib/api";
import { rejectCrossOrigin } from "@/lib/request-origin";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { getAppUrl, getStripe, getStripePriceId } from "@/lib/billing/stripe";
import { trialConfiguration } from "@/lib/billing/trial";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z
  .object({
    plan: z.enum(["core", "premium"]),
    interval: z.enum(["month", "year"]).default("month"),
    intent: z.enum(["trial", "purchase"]).default("purchase"),
    source: z.enum(["onboarding", "billing"]).default("billing"),
  })
  .strict();
const fail = (error: string, status = 409) =>
  NextResponse.json({ error }, { status });
export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return fail("Choose a valid Opryn plan.", 400);
  const { supabase, membership, user } = context;
  const org = membership.organization_id;
  const service = createServiceClient();
  const lease = randomUUID();
  let claimed = false;
  try {
    if (input.data.source === "onboarding") {
      const state = await supabase
        .from("organization_subscriptions")
        .select("activation_completed_at")
        .eq("organization_id", org)
        .single();
      if (state.error || !state.data?.activation_completed_at)
        return fail("Try your first sourced answer before choosing a plan.");
    }
    const trial = input.data.intent === "trial" ? trialConfiguration() : null;
    if (
      trial &&
      (trial.plan !== input.data.plan || trial.interval !== input.data.interval)
    )
      return fail("Choose the configured trial plan.", 400);
    const priceId =
      trial?.priceId || getStripePriceId(input.data.plan, input.data.interval);
    const fingerprint = JSON.stringify([
      priceId,
      input.data.intent,
      input.data.source,
    ]);
    const lock = await service.rpc("claim_organization_checkout", {
      workspace_id: org,
      choice: fingerprint,
      lease,
    });
    if (lock.error) throw lock.error;
    if (!lock.data)
      return fail("Checkout is already opening. Wait a moment and try again.");
    claimed = true;
    const reservation = lock.data as {
      attempt_id: string;
      fingerprint: string;
      session_id: string | null;
      initiated_by: string | null;
    };
    const stripe = getStripe();
    const subscription = await getOrganizationPlan(supabase, org);
    if (trial && subscription.trialUsed)
      return fail(
        "This workspace has already used its trial. Choose a paid plan.",
      );
    let customerId = subscription.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { metadata: { organization_id: org } },
        { idempotencyKey: `opryn-customer-${org}` },
      );
      customerId = customer.id;
      const saved = await service
        .from("organization_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("organization_id", org)
        .select("organization_id")
        .single();
      if (saved.error) throw saved.error;
    }
    const history = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    if (history.has_more)
      return fail("Manage this workspace’s subscription from Billing.");
    if (
      history.data.some(
        (s) => !["canceled", "incomplete_expired"].includes(s.status),
      )
    )
      return fail(
        "A subscription already exists. Return to Opryn or manage it from Billing.",
      );
    if (trial && history.data.some((s) => s.trial_start !== null))
      return fail(
        "This workspace has already used its trial. Choose a paid plan.",
      );
    let attemptId = reservation.attempt_id;
    let initiatedBy = reservation.initiated_by || user.id;
    if (reservation.session_id) {
      const previous = await stripe.checkout.sessions.retrieve(
        reservation.session_id,
      );
      const previousSubscriptionId =
        typeof previous.subscription === "string"
          ? previous.subscription
          : previous.subscription?.id;
      const previousEnded = history.data.some(
        (subscription) =>
          subscription.id === previousSubscriptionId &&
          ["canceled", "incomplete_expired"].includes(subscription.status),
      );
      if (previous.status === "complete" && !previousEnded)
        return fail(
          "Your checkout completed. Return to Opryn while the subscription is confirmed.",
        );
      if (
        previous.status === "open" &&
        reservation.fingerprint === fingerprint &&
        previous.url
      )
        return NextResponse.json({ url: previous.url });
      if (previous.status === "open")
        await stripe.checkout.sessions.expire(previous.id);
      attemptId = randomUUID();
      initiatedBy = user.id;
    } else if (reservation.fingerprint !== fingerprint) {
      return fail(
        "Your previous checkout is still being recovered. Retry your original choice first.",
      );
    }
    const reserved = await service
      .from("organization_checkout")
      .update({
        attempt_id: attemptId,
        fingerprint,
        session_id: null,
        initiated_by: initiatedBy,
      })
      .eq("organization_id", org)
      .eq("lease_id", lease);
    if (reserved.error) throw reserved.error;
    const appUrl = getAppUrl();
    const metadata = {
      organization_id: org,
      user_id: initiatedBy,
      plan: input.data.plan,
      source: input.data.source,
    };
    const checkout = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        customer: customerId,
        client_reference_id: org,
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        payment_method_collection:
          trial && !trial.requiresPaymentMethod ? "if_required" : "always",
        success_url:
          input.data.source === "onboarding"
            ? `${appUrl}/api/billing/return?billing=confirming&workspace=${org}`
            : `${appUrl}/app/settings/billing?billing=confirming`,
        cancel_url:
          input.data.source === "onboarding"
            ? `${appUrl}/api/billing/return?billing=canceled&workspace=${org}`
            : `${appUrl}/pricing?billing=canceled`,
        metadata,
        subscription_data: {
          metadata,
          ...(trial
            ? {
                trial_period_days: trial.days,
                trial_settings: {
                  end_behavior: {
                    missing_payment_method: trial.missingPaymentMethod,
                  },
                },
              }
            : {}),
        },
      },
      { idempotencyKey: `opryn-checkout-${attemptId}` },
    );
    if (!checkout.url) throw new Error("No checkout URL");
    const saved = await service
      .from("organization_checkout")
      .update({ session_id: checkout.id })
      .eq("organization_id", org)
      .eq("lease_id", lease);
    if (saved.error) throw saved.error;
    return NextResponse.json({ url: checkout.url });
  } catch {
    return fail(
      "Checkout couldn't open. Your workspace is safe. Retry the same choice.",
      503,
    );
  } finally {
    if (claimed)
      await service
        .from("organization_checkout")
        .update({ lease_id: null, lease_until: null })
        .eq("organization_id", org)
        .eq("lease_id", lease);
  }
}
