import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { memberScopeContext } from "@/lib/opryn/knowledge/scope-context";
import { knowledgeTitle } from "@/lib/training/model";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import "@/components/training/training.css";
export default async function TrainingSource({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [ctx, { id }] = await Promise.all([requireAppContext(), params]);
  if (!z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const k = await db
    .from("knowledge_chunks")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .eq("id", id)
    .eq("approved", true)
    .is("library_archived_at", null)
    .maybeSingle();
  if (k.error) throw k.error;
  if (!k.data) notFound();
  const scope = await memberScopeContext(
    db,
    ctx.organization.id,
    ctx.user.id,
    "employee",
  );
  if (
    !(
      await trustedAnswerContext(
        db,
        ctx.organization.id,
        [k.data as RetrievedKnowledge],
        scope,
      )
    ).length
  )
    notFound();
  const p = k.data.process_id
    ? await db
        .from("processes")
        .select("id,title,source_title,source_url")
        .eq("organization_id", ctx.organization.id)
        .eq("id", k.data.process_id)
        .maybeSingle()
    : { data: null, error: null };
  if (p.error) throw p.error;
  return (
    <main className="training-workspace">
      <Link
        className="training-button secondary"
        href="/app/training?view=mine"
      >
        ← My learning
      </Link>
      <header className="training-header mt-5">
        <p className="training-eyebrow">
          {ctx.organization.name} · Approved knowledge · v
          {k.data.current_version}
        </p>
        <h1>{knowledgeTitle(k.data)}</h1>
      </header>
      <p className="training-guidance">{k.data.content}</p>
      <section className="training-section">
        <h2>Source and provenance</h2>
        <p>
          {p.data?.source_title ||
            p.data?.title ||
            k.data.source_type.replaceAll("_", " ")}
        </p>
        {p.data && (
          <Link
            className="training-button secondary mt-3"
            href={`/app/processes/${p.data.id}`}
          >
            View source process
          </Link>
        )}
        <p className="training-muted mt-3">
          This is the approved knowledge used by your training. Your
          acknowledgement and practice record the version you learned.
        </p>
      </section>
    </main>
  );
}
