import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Server-owned billing fields; resetting/deleting wizard state cannot grant access. */
export async function billingBoundary(
  supabase: SupabaseClient,
  organizationId: string,
  allowActivation = true,
) {
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select(
      "onboarding_billing_required,activation_completed_at,stripe_subscription_id,status",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Workspace billing status unavailable");
  if (!data.onboarding_billing_required) return false;
  if (allowActivation && !data.activation_completed_at) return false;
  return (
    !data.stripe_subscription_id ||
    !["active", "trialing"].includes(data.status)
  );
}
