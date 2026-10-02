import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSourceFreshness } from "@/lib/opryn/knowledge/source-freshness";
import { PageHeading } from "@/components/app/page-heading";
import { CompanyAnalysis } from "@/components/app/company-analysis";
export default async function CompanyAnalysisPage() {
  const c = await requireAdminContext();
  const db = await createClient();
  const [sources, latest] = await Promise.all([
    getSourceFreshness(createServiceClient(), c.organization.id),
    db
      .from("company_analysis_runs")
      .select("id,status,result")
      .eq("organization_id", c.organization.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (latest.error)
    throw new Error("Saved company analysis could not be loaded.");
  return (
    <>
      <PageHeading
        title="Analyze company knowledge"
        description="Find reviewable guidance and the next useful decision, using only selected sources."
      />
      <CompanyAnalysis
        sources={sources.sources}
        limited={sources.limited}
        initialRun={latest.data}
      />
    </>
  );
}
