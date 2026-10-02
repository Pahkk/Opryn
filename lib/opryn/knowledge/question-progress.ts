import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import { trustedAnswerContext } from "./trust";
import { memberScopeContext } from "./scope-context";
import { resolveKnowledgeSources } from "./sources";

/** The service client reads workflow metadata only after an asker-scoped RLS read.
 * Source content always passes current session access, scope and trust gates.
 * Polling does not run AI, create questions, record reuse, or resolve gaps.
 */
export async function getQuestionProgress(input: {
  session: SupabaseClient;
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  questionId: string;
}) {
  const { session, service, organizationId, userId, questionId } = input;
  const questionResult = await session
    .from("employee_questions")
    .select("id,status,escalated,scope_context")
    .eq("organization_id", organizationId)
    .eq("asked_by", userId)
    .eq("id", questionId)
    .maybeSingle();
  if (questionResult.error) throw questionResult.error;
  if (!questionResult.data) return null;
  const question = questionResult.data;
  const settings = await session
    .from("organization_settings")
    .select("employees_can_ask")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (settings.error) throw settings.error;
  if (settings.data?.employees_can_ask === false)
    return {
      state: "restricted",
      label: "Ask Opryn is disabled for this workspace.",
    };
  if (question.status === "dismissed")
    return {
      state: "dismissed",
      label:
        "This question was closed without changing company knowledge. You can clarify and ask again.",
    };

  const [rechecks, proposals, answers] = await Promise.all([
    service
      .from("knowledge_gap_rechecks")
      .select("status,answer,cited_knowledge_ids,checked_at")
      .eq("organization_id", organizationId)
      .eq("question_id", questionId)
      .order("created_at", { ascending: false })
      .limit(1),
    service
      .from("knowledge_proposals")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("related_question_id", questionId)
      .order("created_at", { ascending: false })
      .limit(1),
    session
      .from("question_answers")
      .select("answer,reusable_intent")
      .eq("organization_id", organizationId)
      .eq("question_id", questionId)
      .in("answer_type", ["owner", "expert"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const error = rechecks.error ?? proposals.error ?? answers.error;
  if (error) throw error;
  const recheck = rechecks.data?.[0];
  if (recheck?.status === "answered" && recheck.answer && recheck.checked_at) {
    const ids = [...new Set<string>(recheck.cited_knowledge_ids ?? [])];
    const rows = ids.length
      ? await session
          .from("knowledge_chunks")
          .select(
            "id,content,source_type,source_id,process_id,rule_id,role_id,updated_at",
          )
          .eq("organization_id", organizationId)
          .in("id", ids)
      : { data: [], error: null };
    if (rows.error) throw rows.error;
    // A saved answer is not proof of current authority. Any change after the
    // checked snapshot withholds the answer until a new question/recheck.
    const unchanged =
      ids.length > 0 &&
      rows.data?.length === ids.length &&
      rows.data.every(
        (row) => Date.parse(row.updated_at) <= Date.parse(recheck.checked_at),
      );
    const trusted = unchanged
      ? await trustedAnswerContext(
          session,
          organizationId,
          (rows.data ?? []).map((row) => ({
            ...row,
            similarity: 1,
          })) as RetrievedKnowledge[],
          await memberScopeContext(
            session,
            organizationId,
            userId,
            "employee",
            question.scope_context ?? {},
          ),
        )
      : [];
    if (trusted.length === ids.length && ids.length) {
      const sources = await resolveKnowledgeSources(session, trusted);
      return {
        state: "approved",
        label: "Approved answer now available",
        answer: recheck.answer,
        sources: sources.map((source) => ({
          id: source.knowledge_id,
          label: `${source.title} → ${source.section}`,
          href: source.url,
          content:
            trusted.find((item) => item.id === source.knowledge_id)?.content ??
            "",
        })),
      };
    }
    return {
      state: "needs_recheck",
      label:
        "Guidance or access changed. Ask again to check the current answer.",
    };
  }
  const proposal = proposals.data?.[0];
  if (proposal?.status === "approved")
    return {
      state: "rechecking",
      label:
        recheck?.status === "error"
          ? "Knowledge approved. Rechecking needs another attempt."
          : recheck?.status === "unknown"
            ? "Knowledge approved. This question still needs more guidance."
            : "Knowledge approved. Checking your original question…",
    };
  if (["pending_approval", "needs_review"].includes(proposal?.status ?? ""))
    return {
      state: "review",
      label: "A reusable answer is waiting for human review.",
    };
  if (proposal?.status === "rejected")
    return {
      state: "denied",
      label: "The proposal was not approved. No company policy changed.",
    };
  const answer = answers.data?.[0];
  if (
    answer &&
    ["answer_only", "one_time_exception"].includes(answer.reusable_intent)
  )
    return {
      state: "one_time",
      label: "Human answer · this question only",
      humanAnswer: answer.answer,
    };
  return {
    state: question.escalated ? "routed" : "unknown",
    label: question.escalated
      ? "Waiting for the right person. An answer does not become company policy without review."
      : "No approved answer yet.",
  };
}
