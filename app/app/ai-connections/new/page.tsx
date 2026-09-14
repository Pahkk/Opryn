import { redirect } from "next/navigation";
import { NewAIConnection } from "@/components/app/ai-connections";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { hasFeature } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";

export default async function NewAIConnectionPage() {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const subscription = await getOrganizationPlan(
    supabase,
    context.organization.id,
  );
  if (!hasFeature(subscription.plan, "aiConnections"))
    redirect("/app/integrations?filter=ai");
  const [{ data: processes }, { data: rules }] = await Promise.all([
    supabase
      .from("processes")
      .select("id,title")
      .eq("organization_id", context.organization.id)
      .eq("status", "approved")
      .order("title"),
    supabase
      .from("process_rules")
      .select("id,title")
      .eq("organization_id", context.organization.id)
      .eq("status", "approved")
      .order("title"),
  ]);
  return (
    <>
      <PageHeading
        eyebrow="Connections"
        title="Connect an AI Agent"
        description="Create secure, read-only access for an agent you already use."
      />
      <NewAIConnection
        knowledgeOptions={[
          ...(processes ?? []).map((item) => ({
            ...item,
            kind: "process" as const,
          })),
          ...(rules ?? []).map((item) => ({ ...item, kind: "rule" as const })),
        ]}
      />
    </>
  );
}
