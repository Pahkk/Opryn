import "server-only";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe } from "@/lib/billing/stripe";
import {
  ConnectionError,
  connectionPath,
  nangoEnvironment,
  nangoRequest,
} from "@/lib/integrations/nango";

/** Invoke only after the owner, exact workspace name and recent auth are verified.
 * Retain references until their external cleanup succeeds, allowing safe retries.
 */
export async function cleanupWorkspace(organizationId: string, userId: string) {
  const db = createServiceClient(),
    deadline = Date.now() + 180_000;
  const check = () => {
    if (Date.now() > deadline) throw new Error("cleanup_retry");
  };
  const cancelled = await db
    .from("integration_connect_attempts")
    .update({ status: "cancelled" })
    .eq("organization_id", organizationId)
    .eq("status", "pending");
  if (cancelled.error) throw new Error("cleanup_retry");
  const connections = await db
    .from("integrations")
    .select(
      "id,auth_platform,provider_config_key,external_connection_id,configuration,status,error_code",
    )
    .eq("organization_id", organizationId);
  if (connections.error) throw new Error("cleanup_retry");
  for (const connection of connections.data ?? []) {
    check();
    if (connection.auth_platform === "nango") {
      if (connection.status === "disconnected" && !connection.error_code)
        continue;
      if (connection.configuration?.environment !== nangoEnvironment())
        throw new Error("cleanup_retry");
      const stopped = await db.rpc("stop_nango_connection", {
        target_org: organizationId,
        target_user: userId,
        target_id: connection.id,
      });
      if (stopped.error || stopped.data !== true)
        throw new Error("cleanup_retry");
      try {
        await nangoRequest(
          connectionPath(
            connection.provider_config_key,
            connection.external_connection_id,
          ),
          { method: "DELETE" },
        );
      } catch (error) {
        if (!(error instanceof ConnectionError && error.status === 404))
          throw error;
      }
      const saved = await db
        .from("integrations")
        .update({ error_code: null })
        .eq("organization_id", organizationId)
        .eq("id", connection.id)
        .eq("external_connection_id", connection.external_connection_id)
        .eq("status", "disconnected");
      if (saved.error) throw new Error("cleanup_retry");
    } else {
      const erased = await db
        .from("integration_credentials")
        .delete()
        .eq("organization_id", organizationId)
        .eq("integration_id", connection.id);
      if (erased.error) throw new Error("cleanup_retry");
      const stopped = await db
        .from("integrations")
        .update({ status: "disconnected", error_code: null })
        .eq("organization_id", organizationId)
        .eq("id", connection.id);
      if (stopped.error) throw new Error("cleanup_retry");
    }
  }
  // Match existing disconnect semantics; never delete the customer's provider account.
  for (const operation of [
    db
      .from("communication_integrations")
      .update({
        status: "disconnected",
        encrypted_credentials: null,
        bot_user_id: null,
      })
      .eq("organization_id", organizationId),
    db
      .from("communication_oauth_states")
      .delete()
      .eq("organization_id", organizationId),
    db
      .from("phone_integrations")
      .update({
        status: "disconnected",
        encrypted_credentials: "",
        error_message: null,
      })
      .eq("organization_id", organizationId),
  ]) {
    const result = await operation;
    if (result.error) throw new Error("cleanup_retry");
  }
  const billing = await db
    .from("organization_subscriptions")
    .select("stripe_subscription_id,stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (billing.error) throw new Error("cleanup_retry");
  if (billing.data?.stripe_subscription_id) {
    check();
    const stripe = getStripe(),
      subscription = await stripe.subscriptions.retrieve(
        billing.data.stripe_subscription_id,
      );
    const customer =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
    if (
      customer !== billing.data.stripe_customer_id ||
      (subscription.metadata.organization_id &&
        subscription.metadata.organization_id !== organizationId)
    )
      throw new Error("cleanup_retry");
    if (!["canceled", "incomplete_expired"].includes(subscription.status))
      await stripe.subscriptions.cancel(subscription.id, {
        invoice_now: false,
        prorate: false,
      });
    const saved = await db
      .from("organization_subscriptions")
      .update({ status: "canceled", cancel_at_period_end: false })
      .eq("organization_id", organizationId)
      .eq("stripe_subscription_id", subscription.id);
    if (saved.error) throw new Error("cleanup_retry");
  }
  for (let batch = 0; batch < 50; batch++) {
    check();
    const manifest = await db.rpc("workspace_deletion_files", {
      workspace_id: organizationId,
    });
    if (manifest.error) throw new Error("cleanup_retry");
    const files = z
      .array(
        z.object({
          bucket_id: z.string().min(1),
          name: z.string().startsWith(organizationId + "/"),
        }),
      )
      .parse(manifest.data);
    if (!files.length) return;
    for (const bucket of new Set(files.map((file) => file.bucket_id))) {
      check();
      const removed = await db.storage
        .from(bucket)
        .remove(
          files
            .filter((file) => file.bucket_id === bucket)
            .map((file) => file.name),
        );
      if (removed.error) throw new Error("cleanup_retry");
    }
  }
  throw new Error("cleanup_retry");
}
