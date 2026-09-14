import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromStripePrice } from "@/lib/billing/stripe";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature || !secret)
    return NextResponse.json(
      { error: "Webhook verification is not configured." },
      { status: 400 },
    );
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: previous } = await service
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("event_id", event.id)
    .maybeSingle();
  if (previous?.processed_at) return NextResponse.json({ received: true });
  await service.from("stripe_webhook_events").upsert(
    {
      event_id: event.id,
      event_type: event.type,
      error_message: null,
    },
    { onConflict: "event_id" },
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        const subscription = await getStripe().subscriptions.retrieve(
          session.subscription,
        );
        await syncSubscription(service, subscription);
      }
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.trial_will_end"
    )
      // Retrieve current state so an older delivered event cannot restore an old plan.
      await syncSubscription(
        service,
        await getStripe().subscriptions.retrieve(
          (event.data.object as Stripe.Subscription).id,
        ),
      );

    if (
      event.type === "invoice.paid" ||
      event.type === "invoice.payment_failed"
    ) {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = invoice.parent?.subscription_details?.subscription;
      if (subscription)
        await syncSubscription(
          service,
          await getStripe().subscriptions.retrieve(
            typeof subscription === "string" ? subscription : subscription.id,
          ),
        );
    }

    await service
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString(), error_message: null })
      .eq("event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await service
      .from("stripe_webhook_events")
      .update({
        error_message:
          error instanceof Error ? error.message.slice(0, 1000) : "Unknown",
      })
      .eq("event_id", event.id);
    console.error("[Opryn Billing] Webhook processing failed", {
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}

async function syncSubscription(
  service: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  let organizationId = subscription.metadata.organization_id;
  if (!organizationId) {
    const { data } = await service
      .from("organization_subscriptions")
      .select("organization_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    organizationId = data?.organization_id;
  }
  if (!organizationId) throw new Error("Subscription organization not found.");
  const deleted = await service
    .from("deleted_workspaces")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (deleted.error) throw deleted.error;
  if (deleted.data) {
    // A checkout completed after the owner confirmed workspace deletion.
    if (!["canceled", "incomplete_expired"].includes(subscription.status))
      await getStripe().subscriptions.cancel(subscription.id, {
        invoice_now: false,
        prorate: false,
      });
    return;
  }
  const item = subscription.items.data[0];
  const mapped = planFromStripePrice(item?.price.id);
  if (!mapped)
    throw new Error("Subscription price is not mapped to an Opryn plan.");
  const status = normalizeStatus(subscription.status);
  const { data: existing } = await service
    .from("organization_subscriptions")
    .select("trial_used,stripe_customer_id,stripe_subscription_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (
    existing?.stripe_customer_id &&
    existing.stripe_customer_id !== customerId
  )
    throw new Error("Subscription customer does not match workspace.");
  if (existing?.stripe_subscription_id && existing.stripe_subscription_id !== subscription.id) {
    const current = await getStripe().subscriptions.retrieve(existing.stripe_subscription_id);
    // A late event from a previous subscription cannot replace its active successor.
    if (!["canceled", "incomplete_expired"].includes(current.status)) return;
  }
  const { error } = await service.from("organization_subscriptions").upsert(
    {
      organization_id: organizationId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan: mapped.plan,
      billing_interval: mapped.interval,
      status,
      current_period_start: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : null,
      current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_used: Boolean(existing?.trial_used || subscription.trial_start),
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    { onConflict: "organization_id" },
  );
  if (error) throw error;
}

function normalizeStatus(status: Stripe.Subscription.Status) {
  if (status === "incomplete_expired") return "canceled";
  return status;
}
