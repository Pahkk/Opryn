import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminContext } from "@/lib/app-context";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeading } from "@/components/app/page-heading";

export default async function SourceHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdminContext();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = createServiceClient();
  const result = await db
    .from("integration_sources")
    .select(
      "title,provider,provider_version,modified_at,last_imported_at,process_id,approved_process_id,normalized_content,previous_content,sync_status,review_status",
    )
    .eq("organization_id", context.organization.id)
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) notFound();
  const source = result.data;
  return (
    <div className="mx-auto max-w-5xl min-w-0">
      <PageHeading
        eyebrow="Source history"
        title={source.title}
        description="Compare imported information before deciding what becomes company knowledge. An import is not an approval."
        actions={
          <Link
            className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
            href="/app/knowledge/health#source-updates"
          >
            Back to Health
          </Link>
        }
      />
      <section className="rounded-3xl border border-[#d7e3f1] bg-white p-5 sm:p-7">
        <p className="font-semibold">
          {source.provider} · Source version{" "}
          {source.provider_version ?? "not supplied"}
        </p>
        <p className="mt-2 text-sm text-[#566279]">
          Latest import:{" "}
          {source.last_imported_at
            ? new Date(source.last_imported_at).toLocaleString("en-US")
            : "Not imported"}
          . Approved versions and provenance remain in Knowledge.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {source.process_id ? (
            <Link
              className="opryn-action"
              href={`/app/processes/${source.process_id}?review=true&returnTo=${encodeURIComponent(`/app/knowledge/sources/${id}`)}`}
            >
              {source.review_status === "declined"
                ? "View declined findings"
                : source.process_id !== source.approved_process_id
                  ? "Review latest findings"
                  : "View approved process"}
            </Link>
          ) : null}
          {source.approved_process_id &&
          source.approved_process_id !== source.process_id ? (
            <Link
              className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
              href={`/app/processes/${source.approved_process_id}`}
            >
              Current approved baseline
            </Link>
          ) : null}
        </div>
      </section>
      <p className="mt-5 text-sm text-[#566279]">
        Previous import means the immediately preceding fetched content, which
        may not have been approved. Older policies stay traceable through their
        process and knowledge history.
      </p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {[
          ["Previous import", source.previous_content],
          ["Latest import", source.normalized_content],
        ].map(([label, content]) => (
          <section key={label} className="min-w-0 rounded-3xl bg-[#eaf4ff] p-5">
            <h2 className="text-xl font-semibold">{label}</h2>
            <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7">
              {content ||
                "No content snapshot recorded yet. Import this selected source to begin tracking."}
            </pre>
          </section>
        ))}
      </div>
    </div>
  );
}
