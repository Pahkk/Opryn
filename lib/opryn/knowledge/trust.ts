import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import { answeringMustWait } from "./health-model";

export class KnowledgeConflictError extends Error {
  constructor() {
    super(
      "Resolve the knowledge conflict in Needs You before approving this item.",
    );
    this.name = "KnowledgeConflictError";
  }
}

/** Called by existing authorized approval services, not by a client-selected org. */
export async function assertNoBlockingKnowledgeConflict(
  service: SupabaseClient,
  organizationId: string,
  chunks: Array<{ id: string; health_status?: string }>,
) {
  if (!chunks.length) return;
  if (chunks.some((chunk) => chunk.health_status === "conflict"))
    throw new KnowledgeConflictError();
  const ids = chunks.map((chunk) => chunk.id);
  const results = await Promise.all(
    ["knowledge_chunk_a", "knowledge_chunk_b"].map((column) =>
      service
        .from("knowledge_conflicts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("status", "open")
        .eq("conflict_type", "conflict")
        .in(column, ids)
        .limit(1),
    ),
  );
  for (const result of results) {
    if (result.error) throw result.error;
    if (result.data?.length) throw new KnowledgeConflictError();
  }
}

/** Same fail-closed trust gate after each channel's permission-scoped retrieval. */
export async function trustedAnswerContext(
  service: SupabaseClient,
  organizationId: string,
  knowledge: RetrievedKnowledge[],
) {
  if (!knowledge.length) return knowledge;
  const ids = [...new Set(knowledge.map((item) => item.id))];
  const [rows, review] = await Promise.all([
    service
      .from("knowledge_chunks")
      .select("id,approved,health_status")
      .eq("organization_id", organizationId)
      .in("id", ids),
    service.rpc("knowledge_context_requires_review", {
      target_organization_id: organizationId,
      target_chunk_ids: ids,
    }),
  ]);
  const error = rows.error ?? review.error;
  if (error) throw error;
  // Do not merely drop one contradictory source and answer from the other.
  if (answeringMustWait(rows.data ?? [], ids.length) || review.data !== false)
    return [];
  return knowledge;
}
