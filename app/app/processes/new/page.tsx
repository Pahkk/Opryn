import { TeachWorkspace } from "@/components/app/teach-workspace";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { safeAppReturnPath } from "@/lib/return-path";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { summarizeQuestionTitle } from "@/lib/question-title";
import { createServiceClient } from "@/lib/supabase/service";
export default async function NewProcessPage({
  searchParams,
}: {
  searchParams: Promise<{
    recommendation?: string;
    returnTo?: string;
    source?: string;
    prompt?: string;
  }>;
}) {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const subscription = await getOrganizationPlan(
    supabase,
    context.organization.id,
  );
  const {
    recommendation: recommendationId,
    returnTo,
    source,
    prompt,
  } = await searchParams;
  const returnPath = safeAppReturnPath(
    returnTo,
    recommendationId ? "/app/getting-started" : "/app/processes",
  );
  const [
    { data: roles },
    { data: recommendation },
    { data: connections },
    { data: providerSources },
    { data: recentSources },
    { data: communication },
    { data: externalAi },
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name")
      .eq("organization_id", context.organization.id)
      .order("name"),
    recommendationId
      ? supabase
          .from("process_recommendations")
          .select("id,title,reason,suggested_prompt")
          .eq("id", recommendationId)
          .eq("organization_id", context.organization.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("integrations")
      .select("id,provider,status,last_sync_at,configuration")
      .eq("organization_id", context.organization.id),
    createServiceClient()
      .from("integration_sources")
      .select("id,provider,sync_status,last_imported_at")
      .eq("organization_id", context.organization.id),
    supabase
      .from("processes")
      .select("id,title,source_provider,learning_source,updated_at")
      .eq("organization_id", context.organization.id)
      .in("learning_source", ["google_drive", "notion", "confluence"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("communication_integrations")
      .select("provider,status")
      .eq("organization_id", context.organization.id),
    supabase
      .from("external_ai_connections")
      .select("provider,status")
      .eq("organization_id", context.organization.id)
      .eq("status", "active"),
  ]);
  const ids = ["google_drive", "notion", "confluence"] as const;
  const sourceSummaries = ids.map((id) => {
    const connection = connections?.find((item) => item.provider === id);
    const selected =
      providerSources?.filter((item) => item.provider === id) ?? [];
    return {
      id,
      connected: connection?.status === "connected",
      connectionId: connection?.status === "connected" ? connection.id : null,
      selectedCount:
        id === "google_drive"
          ? selectedGoogleFiles(connection?.configuration)
          : selected.length,
      status:
        connection && connection.status !== "connected"
          ? ("attention" as const)
          : selected.some((item) => item.sync_status === "changed")
            ? ("changed" as const)
            : ("healthy" as const),
      lastLearned:
        selected
          .map((item) => item.last_imported_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ??
        connection?.last_sync_at ??
        null,
    };
  });
  const communicationState = new Map(
    (communication ?? []).map((item) => [item.provider, item.status]),
  );
  return (
    <>
      <PageHeading
        eyebrow="Teach Opryn"
        title="Teach Opryn."
        description="Start with information you already have. Opryn prepares findings for you to review."
      />
      <TeachWorkspace
        organizationId={context.organization.id}
        organizationName={context.organization.name}
        initialSource={source}
        sourceSummaries={sourceSummaries}
        recentSources={(recentSources ?? []).map((item) => ({
          id: item.id,
          processId: item.id,
          title: item.title,
          provider: item.source_provider || item.learning_source,
          updatedAt: item.updated_at,
        }))}
        useElsewhere={[
          {
            id: "slack",
            name: "Slack",
            connected: communicationState.get("slack") === "active",
          },
          {
            id: "teams",
            name: "Microsoft Teams",
            connected:
              communicationState.get("teams") === "active" ||
              connections?.some(
                (item) =>
                  item.provider === "teams" && item.status === "connected",
              ) === true,
          },
          {
            id: "chatgpt",
            name: "ChatGPT",
            connected:
              externalAi?.some((item) => item.provider === "openai") === true,
          },
          {
            id: "claude",
            name: "Claude",
            connected:
              externalAi?.some((item) => item.provider === "claude") === true,
          },
        ]}
        roles={roles ?? []}
        plan={subscription.plan}
        key={source ?? "text"}
        returnTo={returnPath}
        initial={
          recommendation
            ? {
                title: recommendation.title,
                description: recommendation.reason,
                coachingPrompt: recommendation.suggested_prompt,
                recommendationId: recommendation.id,
              }
            : prompt
              ? {
                  title: summarizeQuestionTitle(prompt),
                  description:
                    "Your team has asked about this. Explain the answer once so Opryn can help next time.",
                  coachingPrompt: prompt.slice(0, 4000),
                }
              : undefined
        }
      />
    </>
  );
}

function selectedGoogleFiles(configuration: unknown) {
  if (!configuration || typeof configuration !== "object") return 0;
  const files = (configuration as { selected_files?: unknown }).selected_files;
  return Array.isArray(files) ? files.length : 0;
}
