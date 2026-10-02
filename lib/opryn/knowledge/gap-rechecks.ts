import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  answerCompanyQuestion,
  embedKnowledge,
  type RetrievedKnowledge,
} from "@/lib/ai/services";
import { trustedAnswerContext } from "./trust";
import { memberScopeContext } from "./scope-context";
class RecheckNeedsImageContext extends Error {}

/** Permission-scoped, side-effect-free answer generation: no synthetic questions/ROI. */
export async function recheckKnowledgeGapAnswers(
  service: SupabaseClient,
  organizationId: string,
  proposalId: string,
  automatic = false,
) {
  const { data: proposal, error: proposalError } = await service
    .from("knowledge_proposals")
    .select("approved_knowledge_id,status")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .single();
  if (proposalError) throw proposalError;
  if (proposal.status !== "approved")
    throw new Error("Approve the proposal before rechecking.");
  const { data: jobs, error: claimError } = await service.rpc(
    automatic ? "claim_scheduled_gap_rechecks" : "claim_knowledge_gap_rechecks",
    {
      target_organization_id: organizationId,
      target_proposal_id: proposalId,
      ...(automatic ? { external_jobs: false } : {}),
    },
  );
  if (claimError) throw claimError;
  const results: Array<{ questionId: string; status: string }> = [];
  for (const job of jobs ?? []) {
    let status: "answered" | "unknown" | "error" = "error";
    let text = "";
    let citations: string[] = [];
    let version: number | null = null;
    try {
      const { data: question, error: questionError } = await service
        .from("employee_questions")
        .select("question,asked_by,conversation_context,scope_context,origin")
        .eq("organization_id", organizationId)
        .eq("id", job.question_id)
        .single();
      if (questionError) throw questionError;
      const attachments = await service
        .from("question_attachments")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("question_id", job.question_id)
        .limit(1);
      if (attachments.error) throw attachments.error;
      if (attachments.data?.length) throw new RecheckNeedsImageContext();
      const history = (
        Array.isArray(question.conversation_context)
          ? question.conversation_context
          : []
      )
        .filter((item): item is { role: "user" | "opryn"; text: string } =>
          Boolean(
            item &&
            (item.role === "user" || item.role === "opryn") &&
            typeof item.text === "string",
          ),
        )
        .slice(-6);
      const clarified = await service
        .from("question_clarifications")
        .select("message,reply")
        .eq("organization_id", organizationId)
        .eq("question_id", job.question_id)
        .eq("status", "answered")
        .order("created_at", { ascending: false })
        .limit(3);
      if (clarified.error) throw clarified.error;
      const questionText = [
        question.question,
        ...(clarified.data ?? []).map(
          (item) =>
            `ASKER CONTEXT (not company authority): ${item.message}\n${item.reply}`,
        ),
      ].join("\n\n");
      const [embedding] = await embedKnowledge([
        [
          ...history
            .filter((item) => item.role === "user")
            .slice(-2)
            .map((item) => item.text),
          questionText,
        ].join("\n"),
      ]);
      const { data: candidates, error: retrievalError } = await service.rpc(
        "match_knowledge_for_communication",
        {
          target_organization_id: organizationId,
          target_user_id: question.asked_by,
          query_embedding: embedding,
          match_threshold: 0.3,
          match_count: 15,
        },
      );
      if (retrievalError) throw retrievalError;
      const knowledge = await trustedAnswerContext(
        service,
        organizationId,
        (candidates ?? []) as RetrievedKnowledge[],
        await memberScopeContext(service, organizationId, question.asked_by, question.origin ?? "employee", question.scope_context ?? {}),
      );
      const { data: chunks, error: chunksError } = knowledge.length
        ? await service
            .from("knowledge_chunks")
            .select("id,current_version,criticality")
            .eq("organization_id", organizationId)
            .in(
              "id",
              knowledge.map((item) => item.id),
            )
        : { data: [], error: null };
      if (chunksError) throw chunksError;
      const { data: settings, error: settingsError } = await service
        .from("organization_settings")
        .select("confidence_threshold,employees_can_ask")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (settingsError) throw settingsError;
      version =
        chunks?.find((item) => item.id === proposal.approved_knowledge_id)
          ?.current_version ?? null;
      const answer =
        knowledge.length && settings?.employees_can_ask !== false
          ? await answerCompanyQuestion(
              questionText,
              knowledge,
              undefined,
              history,
            )
          : null;
      const threshold = chunks?.some((item) => item.criticality === "critical")
        ? Math.max(settings?.confidence_threshold ?? 0.72, 0.9)
        : (settings?.confidence_threshold ?? 0.72);
      citations = [
        ...new Set(
          (answer?.cited_source_ids ?? []).filter((id) =>
            knowledge.some((item) => item.id === id),
          ),
        ),
      ];
      status =
        answer?.can_answer &&
        answer.confidence >= threshold &&
        answer.answer.trim() &&
        citations.includes(proposal.approved_knowledge_id)
          ? "answered"
          : "unknown";
      if (status === "answered" && answer)
        text = [answer.answer, ...answer.steps, answer.important_note]
          .filter(Boolean)
          .join("\n\n");
    } catch (error) {
      // Do not store raw errors, model payloads or credentials. A durable job is retryable.
      status = error instanceof RecheckNeedsImageContext ? "unknown" : "error";
    }
    const { error: commitError } = await service.rpc(
      "complete_knowledge_gap_recheck",
      {
        target_organization_id: organizationId,
        target_proposal_id: proposalId,
        target_question_id: job.question_id,
        result_status: status,
        result_answer: text,
        result_citations: citations,
        expected_knowledge_version: version,
      },
    );
    if (commitError) throw commitError; // Fail closed: leave the saved job unresolved.
    results.push({ questionId: job.question_id, status });
  }
  return results;
}
