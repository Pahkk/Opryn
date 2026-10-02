import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import {
  knowledgeScopeSchema,
  matchKnowledgeScope,
  type ScopeContext,
} from "./scope";

export async function scopedKnowledgeContext<T extends Pick<RetrievedKnowledge,"id">>(
  service: SupabaseClient,
  organizationId: string,
  knowledge: T[],
  context: ScopeContext = {},
) {
  if (!knowledge.length)
    return { knowledge, missing: [] as string[], outside: 0 };
  const { data, error } = await service
    .from("knowledge_chunks")
    .select("id,scope")
    .eq("organization_id", organizationId)
    .in(
      "id",
      knowledge.map((k) => k.id),
    );
  if (error) throw error;
  const rows = new Map((data ?? []).map((row) => [row.id, row]));
  const missing = new Set<string>();
  let outside = 0;
  const matched = knowledge.filter((item) => {
    const row = rows.get(item.id);
    if (!row) {
      outside++;
      return false;
    }
    const result = matchKnowledgeScope(
      knowledgeScopeSchema.parse(row.scope ?? {}),
      context,
    );
    result.missing.forEach((d) => missing.add(d));
    if (result.status === "outside_scope") outside++;
    return result.status === "matches";
  });
  // A potentially applicable scoped rule needs context before choosing a global alternative.
  return {
    knowledge: missing.size ? [] : matched,
    missing: [...missing],
    outside,
  };
}
