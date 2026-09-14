import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { findCompanyExpert as findBestExpert } from "@/lib/opryn/knowledge/experts";
import {
  answerCompanyQuestion,
  embedKnowledge,
  type RetrievedKnowledge,
} from "@/lib/ai/services";
import type {
  ChannelAnswerResult,
  ChannelSource,
  CommunicationProvider,
} from "@/lib/communication/types";

export async function answerCommunicationQuestion(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  provider: CommunicationProvider;
  question: string;
  conversationId: string;
  history: Array<{ role: "user" | "opryn"; text: string }>;
}): Promise<ChannelAnswerResult> {
  const { service } = input;
  const retrievalQuery = [
    ...input.history
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.text),
    input.question,
  ].join("\n");
  const [{ data: settings }, embeddingResult] = await Promise.all([
    service
      .from("organization_settings")
      .select("employees_can_ask,allow_escalations,confidence_threshold")
      .eq("organization_id", input.organizationId)
      .maybeSingle(),
    embedKnowledge([retrievalQuery]),
  ]);
  if (settings && !settings.employees_can_ask)
    throw new ChannelPermissionError(
      "Ask Opryn is disabled for this workspace.",
    );
  const embedding = embeddingResult[0];
  const { data, error } = await service.rpc(
    "match_knowledge_for_communication",
    {
      target_organization_id: input.organizationId,
      target_user_id: input.userId,
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 15,
    },
  );
  if (error) throw error;
  const knowledge = await trustedAnswerContext(
    service,
    input.organizationId,
    (data ?? []) as RetrievedKnowledge[],
  );
  const { data: criticalRows } = knowledge.length
    ? await service
        .from("knowledge_chunks")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("criticality", "critical")
        .in(
          "id",
          knowledge.map((item) => item.id),
        )
    : { data: [] };
  const answer = knowledge.length
    ? await answerCompanyQuestion(
        input.question,
        knowledge,
        undefined,
        input.history,
      )
    : null;
  const threshold = criticalRows?.length
    ? Math.max(settings?.confidence_threshold ?? 0.72, 0.9)
    : (settings?.confidence_threshold ?? 0.72);
  if (
    !answer?.can_answer ||
    answer.confidence < threshold ||
    !answer.answer.trim()
  )
    return createUnknown({ ...input, embedding, knowledge });

  const cited = knowledge.filter((item) =>
    answer.cited_source_ids.includes(item.id),
  );
  if (!cited.length) return createUnknown({ ...input, embedding, knowledge });
  const { data: question, error: questionError } = await service
    .from("employee_questions")
    .insert({
      organization_id: input.organizationId,
      asked_by: input.userId,
      question: input.question,
      status: "answered",
      answered_by_opryn: true,
      escalated: false,
      related_process_id: cited[0].process_id,
      relevance_score: cited[0].similarity,
      conversation_id: input.conversationId,
      conversation_context: input.history,
      origin: input.provider,
    })
    .select("id")
    .single();
  if (questionError) throw questionError;
  const answerText = [
    answer.answer,
    answer.steps.length
      ? answer.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
      : "",
    answer.important_note,
  ]
    .filter(Boolean)
    .join("\n\n");
  const [{ error: answerError }, { error: sourcesError }] = await Promise.all([
    service.from("question_answers").insert({
      organization_id: input.organizationId,
      question_id: question.id,
      answer: answerText,
      answered_by: null,
      answer_type: "opryn",
    }),
    service.from("question_sources").insert(
      cited.map((item) => ({
        organization_id: input.organizationId,
        question_id: question.id,
        knowledge_chunk_id: item.id,
        similarity: item.similarity,
      })),
    ),
  ]);
  if (answerError) throw answerError;
  if (sourcesError) throw sourcesError;
  await Promise.all([
    service.rpc("record_knowledge_usage", {
      target_organization_id: input.organizationId,
      target_chunk_ids: cited.map((item) => item.id),
      usage_origin: "employee",
    }),
    service.from("knowledge_events").insert([
      {
        organization_id: input.organizationId,
        event_type: "question_asked",
        actor_id: input.userId,
        question_id: question.id,
        metadata: { origin: input.provider },
      },
      {
        organization_id: input.organizationId,
        event_type: "question_answered",
        actor_id: input.userId,
        question_id: question.id,
        knowledge_chunk_id: cited[0].id,
        metadata: { origin: input.provider, source_count: cited.length },
      },
    ]),
  ]);
  return {
    status: "answered",
    questionId: question.id,
    headline: answer.headline,
    answer: answer.answer,
    steps: answer.steps,
    importantNote: answer.important_note,
    requiresApproval: answer.requires_approval,
    approvalReason: answer.approval_reason,
    sources: await buildChannelSources(service, cited),
  };
}

async function createUnknown(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  provider: CommunicationProvider;
  question: string;
  conversationId: string;
  history: Array<{ role: "user" | "opryn"; text: string }>;
  embedding: number[];
  knowledge: RetrievedKnowledge[];
}): Promise<ChannelAnswerResult> {
  const { data: clusterId, error: clusterError } = await input.service.rpc(
    "record_question_cluster",
    {
      target_organization_id: input.organizationId,
      question_text: input.question,
      question_embedding: input.embedding,
      question_origin: input.provider,
    },
  );
  if (clusterError) throw clusterError;
  const expert = await findBestExpert(
    input.service,
    input.organizationId,
    input.question,
    input.knowledge[0]?.id,
  );
  const { data: question, error } = await input.service
    .from("employee_questions")
    .insert({
      organization_id: input.organizationId,
      asked_by: input.userId,
      question: input.question,
      status: "needs_owner",
      answered_by_opryn: false,
      escalated: false,
      relevance_score: input.knowledge[0]?.similarity ?? null,
      cluster_id: clusterId,
      assigned_expert_id: expert?.id ?? null,
      assigned_expert_rule_id: expert?.assignmentId ?? null,
      conversation_id: input.conversationId,
      conversation_context: input.history,
      origin: input.provider,
    })
    .select("id")
    .single();
  if (error) throw error;
  await input.service.from("knowledge_events").insert([
    {
      organization_id: input.organizationId,
      event_type: "question_asked",
      actor_id: input.userId,
      question_id: question.id,
      metadata: { origin: input.provider },
    },
    {
      organization_id: input.organizationId,
      event_type: "question_unknown",
      actor_id: input.userId,
      question_id: question.id,
      metadata: {
        origin: input.provider,
        has_related_knowledge: Boolean(input.knowledge[0]),
      },
    },
    {
      organization_id: input.organizationId,
      event_type: "question_clustered",
      actor_id: input.userId,
      question_id: question.id,
      source_id: clusterId,
      metadata: { origin: input.provider },
    },
  ]);
  const relatedSource = input.knowledge[0]
    ? ((await buildChannelSources(input.service, [input.knowledge[0]]))[0] ??
      null)
    : null;
  return {
    status: "unknown",
    questionId: question.id,
    expert: expert ? { id: expert.id, name: expert.name } : null,
    related: input.knowledge[0]
      ? { content: input.knowledge[0].content, source: relatedSource }
      : null,
  };
}

async function buildChannelSources(
  service: SupabaseClient,
  items: RetrievedKnowledge[],
): Promise<ChannelSource[]> {
  const processIds = [
    ...new Set(
      items.flatMap((item) => (item.process_id ? [item.process_id] : [])),
    ),
  ];
  const sourceIds = [...new Set(items.map((item) => item.source_id))];
  const ruleIds = [
    ...new Set(items.flatMap((item) => (item.rule_id ? [item.rule_id] : []))),
  ];
  const [processes, steps, rules] = await Promise.all([
    processIds.length
      ? service.from("processes").select("id,title").in("id", processIds)
      : Promise.resolve({ data: [] }),
    sourceIds.length
      ? service.from("process_steps").select("id,title").in("id", sourceIds)
      : Promise.resolve({ data: [] }),
    [...new Set([...sourceIds, ...ruleIds])].length
      ? service
          .from("process_rules")
          .select("id,title")
          .in("id", [...new Set([...sourceIds, ...ruleIds])])
      : Promise.resolve({ data: [] }),
  ]);
  const processNames = new Map(
    (processes.data ?? []).map((row) => [row.id, row.title]),
  );
  const stepNames = new Map(
    (steps.data ?? []).map((row) => [row.id, row.title]),
  );
  const ruleNames = new Map(
    (rules.data ?? []).map((row) => [row.id, row.title]),
  );
  return items.map((item) => {
    const processTitle = item.process_id
      ? processNames.get(item.process_id) || "Company process"
      : "Company knowledge";
    const section =
      ruleNames.get(item.rule_id ?? item.source_id) ||
      stepNames.get(item.source_id) ||
      sourceTypeLabel(item.source_type);
    const anchor = ruleNames.has(item.rule_id ?? item.source_id)
      ? `#rule-${item.rule_id ?? item.source_id}`
      : stepNames.has(item.source_id)
        ? `#step-${item.source_id}`
        : "";
    return {
      id: item.id,
      title: processTitle,
      section,
      href: item.process_id
        ? `/app/processes/${item.process_id}${anchor}`
        : item.rule_id
          ? `/app/processes#knowledge-${item.rule_id}`
          : null,
    };
  });
}

function sourceTypeLabel(type: string) {
  return (
    {
      process_summary: "Overview",
      process_step: "Process step",
      rule: "Approval limits",
      exception: "Exception",
      owner_answer: "Owner answer",
      role_instruction: "Role guidance",
      call_finding: "Approved call knowledge",
    }[type] || "Approved company knowledge"
  );
}

export class ChannelPermissionError extends Error {}
