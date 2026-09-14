import { redirect } from "next/navigation";
import { GuidedOnboarding } from "@/components/onboarding/guided-onboarding";
import { ActivationOnboarding } from "@/components/onboarding/activation-onboarding";
import { getOptionalAppContext, requireUser } from "@/lib/app-context";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; code?: string; billing?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  if (params.mode === "join")
    return (
      <GuidedOnboarding
        firstName={
          String(user.user_metadata.full_name || "there").split(" ")[0]
        }
        joinMode
        initialCode={(params.code ?? "").slice(0, 500)}
      />
    );
  const context = await getOptionalAppContext();
  if (!context) return <ActivationOnboarding />;
  if (!context.isAdmin) redirect("/app");
  const supabase = await createClient();
  const plan = await getOrganizationPlan(supabase, context.organization.id);
  return (
    <ActivationOnboarding
      key={context.organization.id}
      organizationId={context.organization.id}
      plan={plan.plan}
      billingReturn={
        params.billing === "confirming" || params.billing === "canceled" || params.billing === "required"
      }
    />
  );
}
