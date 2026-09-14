import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function KnowledgeHealthPreview({
  organizationId,
}: {
  organizationId: string;
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
