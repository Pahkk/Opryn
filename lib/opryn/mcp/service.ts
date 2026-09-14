import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findCompanyExpert as findBestExpert } from "@/lib/opryn/knowledge/experts";
import {
  answerCompanyQuestion,
  type RetrievedKnowledge,
} from "@/lib/ai/services";
import type { McpAuthContext } from "@/lib/opryn/oauth/tokens";
import { mcpQuestionOrigin } from "@/lib/opryn/mcp/config";
import { searchCompanyKnowledge } from "@/lib/opryn/knowledge/retrieval";
import { resolveKnowledgeSources } from "@/lib/opryn/knowledge/sources";

export async function askOprynFromMcp(
  service: SupabaseClient,
  auth: McpAuthContext,
  question: string,
  context?: string,
) {
  const retrievalQuery = context?.trim()
    ? `${question}\n${context.trim()}`
    : question;
  const [{ knowledge, embedding }, { data: settings }] = await Promise.all([
    searchCompanyKnowledge({
      service,
      organizationId: auth.organizationId,
      userId: auth.userId,
      query: retrievalQuery,
      limit: 15,
    }),
    service
      .from("organization_settings")
      .select("employees_can_ask,allow_escalations,confidence_threshold")
      .eq("organization_id", auth.organizationId)
      .maybeSingle(),
  ]);
  if (settings && !settings.employees_can_ask)
    throw new Error("Ask Opryn is disabled for this workspace.");
  const criticalIds = await getCriticalIds(
    service,
    auth.organizationId,
    knowledge,
  );
  const answer = knowledge.length
    ? await answerCompanyQuestion(
        context?.trim()
          ? `${question}\n\nSITUATIONAL CONTEXT:\n${context.trim()}`
          : question,
        knowledge,
      )
    : null;
  const threshold = criticalIds.size
    ? Math.max(settings?.confidence_threshold ?? 0.72, 0.9)
    : (settings?.confidence_threshold ?? 0.72);
  const cited = answer?.can_answer
    ? knowledge.filter((item) => answer.cited_source_ids.includes(item.id))
    : [];
  if (
    !answer?.can_answer ||
    answer.confidence < threshold ||
    !answer.answer.trim() ||
    !cited.length
  ) {
    const questionId = await recordUnknownQuestion(
      service,
      auth,
      question,
      context,
      embedding,
      knowledge,
    );
    const related = knowledge[0]
      ? {
          content: knowledge[0].content,
          source: (await resolveKnowledgeSources(service, [knowledge[0]]))[0],
        }
      : null;
    return {
      status: "unknown" as const,
      answer: null,
      message: criticalIds.size
        ? "Owner guidance is required. Opryn will not guess about critical company policy."
        : "Opryn does not have an approved company answer for this yet.",
      can_escalate:
        Boolean(settings?.allow_escalations ?? true) &&
        auth.scopes.has("opryn.escalations.create"),
      question_id: questionId,
      related_information: related,
    };
  }
  const answerText = [
    answer.answer,
    answer.steps.length
      ? answer.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
      : "",
    answer.important_note,
  ]
    .filter(Boolean)
    .join("\n\n");
  const { data: questionRow, error: questionError } = await service
    .from("employee_questions")
    .insert({
      organization_id: auth.organizationId,
      asked_by: auth.userId,
      question,
      status: "answered",
      answered_by_opryn: true,
      escalated: false,
      related_process_id: cited[0].process_id,
      relevance_score: cited[0].similarity,
      origin: mcpQuestionOrigin(auth.clientKind),
    })
    .select("id")
    .single();
  if (questionError) throw questionError;
  const [{ error: answerError }, { error: sourcesError }] = await Promise.all([
    service.from("question_answers").insert({
      organization_id: auth.organizationId,
      question_id: questionRow.id,
      answer: answerText,
      answered_by: null,
      answer_type: "opryn",
    }),
    service.from("question_sources").insert(
      cited.map((item) => ({
        organization_id: auth.organizationId,
        question_id: questionRow.id,
        knowledge_chunk_id: item.id,
        similarity: item.similarity,
      })),
    ),
  ]);
  if (answerError) throw answerError;
  if (sourcesError) throw sourcesError;
  await Promise.all([
    service.rpc("record_knowledge_usage", {
      target_organization_id: auth.organizationId,
      target_chunk_ids: cited.map((item) => item.id),
      usage_origin: "external_ai",
    }),
    service.from("knowledge_events").insert([
      {
        organization_id: auth.organizationId,
        event_type: "question_asked",
        actor_id: auth.userId,
        question_id: questionRow.id,
        metadata: {
          origin: mcpQuestionOrigin(auth.clientKind),
          client: auth.clientKind,
        },
      },
      {
        organization_id: auth.organizationId,
        event_type: "question_answered",
        actor_id: auth.userId,
        question_id: questionRow.id,
        knowledge_chunk_id: cited[0].id,
        metadata: {
          origin: mcpQuestionOrigin(auth.clientKind),
          source_count: cited.length,
        },
      },
    ]),
  ]);
  return {
    status: "answered" as const,
    answer: answerText,
    requires_approval: answer.requires_approval,
    approval_reason: answer.approval_reason || undefined,
    sources: auth.scopes.has("opryn.sources.read")
      ? await resolveKnowledgeSources(service, cited)
      : [],
  };
}

export async function requestGuidanceFromMcp(
  service: SupabaseClient,
  auth: McpAuthContext,
  question: string,
  context?: string,
) {
  const origin = mcpQuestionOrigin(auth.clientKind);
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: existing } = await service
    .from("employee_questions")
    .select("id,assigned_expert_id")
    .eq("organization_id", auth.organizationId)
    .eq("asked_by", auth.userId)
    .eq("origin", origin)
    .eq("question", question)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let questionId = existing?.id;
  let expertId = existing?.assigned_expert_id ?? null;
  if (!questionId) {
    const { knowledge, embedding } = await searchCompanyKnowledge({
      service,
      organizationId: auth.organizationId,
      userId: auth.userId,
      query: question,
      limit: 5,
    });
    const { data: clusterId } = await service.rpc("record_question_cluster", {
      target_organization_id: auth.organizationId,
      question_text: question,
      question_embedding: embedding,
      question_origin: origin,
    });
    const expert = await findBestExpert(
      service,
      auth.organizationId,
      question,
      knowledge[0]?.id,
    );
    expertId = expert?.id ?? null;
    const { data, error } = await service
      .from("employee_questions")
      .insert({
        organization_id: auth.organizationId,
        asked_by: auth.userId,
        question,
        status: "needs_owner",
        answered_by_opryn: false,
        escalated: true,
        assigned_expert_id: expertId,
        cluster_id: clusterId,
        conversation_context: context ? [{ role: "user", text: context }] : [],
        origin,
      })
      .select("id")
      .single();
    if (error) throw error;
    questionId = data.id;
  } else {
    await service
      .from("employee_questions")
      .update({ escalated: true })
      .eq("id", questionId)
      .eq("organization_id", auth.organizationId);
  }
  let assignedTo = expertId;
  if (!assignedTo) {
    const { data: owner } = await service
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", auth.organizationId)
      .in("permission_level", ["owner", "admin"])
      .order("joined_at")
      .limit(1)
      .maybeSingle();
    assignedTo = owner?.user_id ?? null;
  }
  if (assignedTo)
    await service.from("notifications").insert({
      organization_id: auth.organizationId,
      user_id: assignedTo,
      type: "question_escalated",
      title: "Opryn needs your guidance",
      body: `${auth.clientName}: ${question.slice(0, 220)}`,
      link: `/app?question=${questionId}#needs-you`,
      entity_type: "question",
      entity_id: questionId,
      action: "answer",
      target_url: `/app?question=${questionId}#needs-you`,
    });
  await service.from("knowledge_events").insert({
    organization_id: auth.organizationId,
    event_type: "question_escalated",
    actor_id: auth.userId,
    question_id: questionId,
    metadata: { origin, client: auth.clientKind },
  });
  return {
    status: "submitted" as const,
    message: assignedTo
      ? "Opryn asked the appropriate person for guidance."
      : "Opryn saved this question for the workspace owner.",
    escalation_id: questionId,
  };
}

async function recordUnknownQuestion(
  service: SupabaseClient,
  auth: McpAuthContext,
  question: string,
  context: string | undefined,
  embedding: number[],
  knowledge: RetrievedKnowledge[],
) {
  const origin = mcpQuestionOrigin(auth.clientKind);
  const { data: clusterId, error: clusterError } = await service.rpc(
    "record_question_cluster",
    {
      target_organization_id: auth.organizationId,
      question_text: question,
      question_embedding: embedding,
      question_origin: origin,
    },
  );
  if (clusterError) throw clusterError;
  const expert = await findBestExpert(
    service,
    auth.organizationId,
    question,
    knowledge[0]?.id,
  );
  const { data, error } = await service
    .from("employee_questions")
    .insert({
      organization_id: auth.organizationId,
      asked_by: auth.userId,
      question,
      status: "needs_owner",
      answered_by_opryn: false,
      escalated: false,
      relevance_score: knowledge[0]?.similarity ?? null,
      cluster_id: clusterId,
      assigned_expert_id: expert?.id ?? null,
      conversation_context: context ? [{ role: "user", text: context }] : [],
      origin,
    })
    .select("id")
    .single();
  if (error) throw error;
  await service.from("knowledge_events").insert([
    {
      organization_id: auth.organizationId,
      event_type: "question_asked",
      actor_id: auth.userId,
      question_id: data.id,
      metadata: { origin, client: auth.clientKind },
    },
    {
      organization_id: auth.organizationId,
      event_type: "question_unknown",
      actor_id: auth.userId,
      question_id: data.id,
      metadata: { origin, has_related_knowledge: Boolean(knowledge[0]) },
    },
    {
      organization_id: auth.organizationId,
      event_type: "question_clustered",
      actor_id: auth.userId,
      question_id: data.id,
      source_id: clusterId,
      metadata: { origin },
    },
  ]);
  return data.id;
}

async function getCriticalIds(
  service: SupabaseClient,
  organizationId: string,
  knowledge: RetrievedKnowledge[],
) {
  if (!knowledge.length) return new Set<string>();
  const { data } = await service
    .from("knowledge_chunks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("criticality", "critical")
    .in(
      "id",
      knowledge.map((item) => item.id),
    );
  return new Set((data ?? []).map((row) => row.id));
}

export async function logMcpActivity(
  service: SupabaseClient,
  auth: McpAuthContext,
  input: {
    toolName: string;
    resultStatus: string;
    sourceCount?: number;
    startedAt: number;
  },
) {
  await service.from("mcp_activity").insert({
    organization_id: auth.organizationId,
    user_id: auth.userId,
    grant_id: auth.grantId,
    client_kind: auth.clientKind,
    tool_name: input.toolName,
    result_status: input.resultStatus,
    source_count: input.sourceCount ?? 0,
    latency_ms: Math.max(0, Date.now() - input.startedAt),
  });
}
