import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** One routing rule for Web, communication channels and remote MCP. */
export async function findCompanyExpert(
  service: SupabaseClient,
  organizationId: string,
  question: string,
  closestKnowledgeId?: string,
) {
  const { data, error } = await service.rpc("find_company_knowledge_expert", {
    target_organization_id: organizationId,
    question_text: question.slice(0, 8000),
    closest_chunk_id: closestKnowledgeId ?? null,
  });
  if (error) throw error;
  const match = data?.[0] as
    { user_id: string; full_name: string; assignment_id: string } | undefined;
  return match
    ? {
        id: match.user_id,
        name: match.full_name || "Company expert",
        assignmentId: match.assignment_id,
      }
    : null;
}
