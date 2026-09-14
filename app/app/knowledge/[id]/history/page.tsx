import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/app/page-heading";

export default async function KnowledgeHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdminContext();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const service = await createClient();
  const [knowledge, versions, confirmations] = await Promise.all([
    service
      .from("knowledge_chunks")
      .select(
        "id,content,process_id,source_type,approved,current_version,last_confirmed_at,updated_at,health_status",
      )
      .eq("organization_id", context.organization.id)
      .eq("id", id)
      .maybeSingle(),
    service
      .from("knowledge_versions")
      .select(
        "id,version_number,title,content,change_reason,created_at,profiles!knowledge_versions_changed_by_fkey(full_name)",
      )
      .eq("organization_id", context.organization.id)
      .eq("knowledge_chunk_id", id)
      .order("version_number", { ascending: false })
      .limit(100),
    service
      .from("knowledge_events")
      .select(
        "id,created_at,profiles!knowledge_events_actor_id_fkey(full_name)",
      )
      .eq("organization_id", context.organization.id)
      .eq("knowledge_chunk_id", id)
      .eq("event_type", "knowledge_confirmed")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (knowledge.error || versions.error || confirmations.error)
    throw knowledge.error ?? versions.error ?? confirmations.error;
  if (!knowledge.data) notFound();
  const item = knowledge.data;
  const name = (raw: unknown) => {
    const value = raw as
      { full_name?: string } | { full_name?: string }[] | null;
    return (
      (Array.isArray(value) ? value[0] : value)?.full_name ||
      "An authorized reviewer"
    );
  };
  return (
    <div className="memory-page mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Company memory"
        title="Source & version history"
        description="Previous knowledge stays traceable. A historical version is not current company policy."
        actions={
          <Link
            className="opryn-button-secondary px-4 py-3"
            href="/app/knowledge/health"
          >
            Back to Health
          </Link>
        }
      />
      <section className="memory-section rounded-3xl border border-[#dbe4f0] bg-white p-5 sm:p-8">
        <p className="text-sm font-semibold text-[#3158d8]">
          Current record · Version {item.current_version} ·{" "}
          {item.approved ? "Approved" : "Needs Review"}
        </p>
        <p className="mt-5 whitespace-pre-wrap break-words text-base leading-7">
          {item.content}
        </p>
        <p className="mt-5 text-sm text-[#657286]">
          Source:{" "}
          {(
            {
              owner_answer: "Owner answer",
              rule: "Company rule",
              process_summary: "Process overview",
              process_step: "Process step",
              faq: "Company FAQ",
            } as Record<string, string>
          )[item.source_type] || "Company source"}
        </p>
        <p className="mt-2 text-sm text-[#657286]">
          Last confirmed:{" "}
          {item.last_confirmed_at
            ? new Date(item.last_confirmed_at).toLocaleDateString("en-US")
            : "Not recorded"}
        </p>
        {item.health_status !== "healthy" ? (
          <p className="mt-2 text-sm">
            This item needs review before it can be relied on.
          </p>
        ) : null}
        <Link
          href={
            item.process_id
              ? `/app/processes/${item.process_id}?review=true`
              : `/app/processes/new?prompt=${encodeURIComponent(`Review this existing guidance and propose an update: ${item.content.slice(0, 1000)}`)}`
          }
          className="opryn-action mt-6"
        >
          {item.process_id ? "Review process & source" : "Propose an update"}
        </Link>
      </section>
      <h2 className="mt-9 text-2xl font-semibold">Recorded versions</h2>
      <p className="mt-2 text-sm text-[#657286]">
        Up to 100 saved versions. Earlier versions are read-only here; changes
        go through the normal review workflow.
      </p>
      {versions.data?.length ? (
        versions.data.map((version) => (
          <details
            key={version.id}
            className="mt-4 rounded-2xl border border-[#e0e5ec] bg-white p-5"
          >
            <summary className="cursor-pointer font-semibold">
              Version {version.version_number}{" "}
              <span className="text-sm font-normal text-[#657286]">
                · {new Date(version.created_at).toLocaleDateString("en-US")}
              </span>
            </summary>
            <p className="mt-3 text-xs text-[#657286]">
              {name(version.profiles)} ·{" "}
              {version.change_reason || "Knowledge saved"}
            </p>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7">
              {version.content}
            </p>
          </details>
        ))
      ) : (
        <p className="mt-5 text-sm text-[#657286]">
          No earlier versions have been recorded.
        </p>
      )}
      <h2 className="mt-9 text-xl font-semibold">Recent confirmations</h2>
      {confirmations.data?.length ? (
        confirmations.data.map((confirmation) => (
          <p key={confirmation.id} className="mt-3 text-sm text-[#657286]">
            {name(confirmation.profiles)} confirmed this on{" "}
            {new Date(confirmation.created_at).toLocaleDateString("en-US")}.
          </p>
        ))
      ) : (
        <p className="mt-3 text-sm text-[#657286]">
          No explicit confirmation events recorded yet.
        </p>
      )}
    </div>
  );
}
