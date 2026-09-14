import { TeachWorkspace } from "@/components/app/teach-workspace";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { safeAppReturnPath } from "@/lib/return-path";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { summarizeQuestionTitle } from "@/lib/question-title";
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
  const [{ data: roles }, { data: recommendation }] = await Promise.all([
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
  ]);
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
