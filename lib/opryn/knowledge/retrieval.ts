import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedKnowledge, type RetrievedKnowledge } from "@/lib/ai/services";
import { trustedAnswerContext } from "./trust";

export async function searchCompanyKnowledge(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  query: string;
  limit?: number;
  threshold?: number;
}) {
  const [embedding] = await embedKnowledge([input.query]);
  const { data, error } = await input.service.rpc(
    "match_knowledge_for_communication",
    {
      target_organization_id: input.organizationId,
      target_user_id: input.userId,
      query_embedding: embedding,
      match_threshold: input.threshold ?? 0.3,
      match_count: Math.min(Math.max(input.limit ?? 12, 1), 20),
    },
  );
  if (error) throw error;
  return {
    knowledge: await trustedAnswerContext(
      input.service,
      input.organizationId,
      (data ?? []) as RetrievedKnowledge[],
    ),
    embedding,
  };
}
