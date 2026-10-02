import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function KnowledgeHealthPreview({
  organizationId,
  compact = false,
  reviewCount = 0,
  freshnessCount = 0,
}: {
  organizationId: string;
  compact?: boolean;
  reviewCount?: number;
  freshnessCount?: number;
}) {
  const service = await createClient();
  const [approved, conflicts] = await Promise.all([
    service
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("approved", true),
    service
      .from("knowledge_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open")
      .eq("conflict_type", "conflict"),
  ]);
  if (approved.error || conflicts.error)
    return (
      <Link
        className="my-5 inline-flex min-h-11 items-center font-semibold text-[#3158d8]"
        href="/app/knowledge/health"
      >
        View Knowledge Health →
      </Link>
    );
  if (compact)
    return (
      <section
        aria-labelledby="home-health-title"
        className="home-health-summary"
      >
        <p className="owner-eyebrow">The guidance behind the answers</p>
        <h2 id="home-health-title">Knowledge health</h2>
        <dl className="home-health-counts">
          <div>
            <dt>
              <span aria-hidden="true" style={{ background: "#496c59" }} />
              Approved entries
            </dt>
            <dd>{approved.count ?? 0}</dd>
          </div>
          <div>
            <dt>
              <span aria-hidden="true" style={{ background: "#2855f9" }} />
              Approval decisions
            </dt>
            <dd>{reviewCount}</dd>
          </div>
          <div>
            <dt>
              <span aria-hidden="true" style={{ background: "#bc3a45" }} />
              Open conflicts
            </dt>
            <dd>{conflicts.count ?? 0}</dd>
          </div>
          <div>
            <dt>
              <span aria-hidden="true" style={{ background: "#a66810" }} />
              Potentially outdated
            </dt>
            <dd>{freshnessCount}</dd>
          </div>
        </dl>
        <p className="home-health-note">
          Review coverage, source freshness, and key-person dependencies.
        </p>
        <Link className="home-health-link" href="/app/knowledge/health">
          View knowledge health →
        </Link>
      </section>
    );
  return (
    <section className="memory-section my-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfe5ed] bg-[#f7f9fc] p-5 sm:p-6">
      <div className="max-w-xl">
        <p className="text-xs font-semibold text-[#3158d8]">COMPANY MEMORY</p>
        <h2 className="mt-2 text-xl font-semibold">Knowledge Health</h2>
        <p className="mt-2 text-sm leading-6 text-[#657286]">
          {approved.count
            ? `${approved.count} approved entries. ${conflicts.count ? `${conflicts.count} unresolved conflicts need a decision.` : "Check coverage, freshness, and who your knowledge depends on."}`
            : "Your first reviewed source starts a company memory your team can rely on."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/app/knowledge/health" className="opryn-action">
          View Health
        </Link>
        <Link
          href="/app/knowledge/week"
          className="opryn-button-secondary px-4 py-3"
        >
          Your Opryn Week
        </Link>
      </div>
    </section>
  );
}
