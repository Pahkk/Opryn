import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { freshnessReason } from "@/lib/opryn/knowledge/health-model";

export type NeedsYouKind = "answer" | "approve" | "conflict" | "update";
export type NeedsYouPriority = "now" | "soon" | "can_wait";

export type NeedsYouItem = {
  id: string;
  type:
    | "question"
    | "knowledge_proposal"
    | "process"
    | "conflict"
    | "freshness"
    | "feedback"
    | "integration";
  kind: NeedsYouKind;
  priority: NeedsYouPriority;
  title: string;
  summary: string;
  detail?: string;
  source?: string;
  targetId: string;
  targetUrl: string;
  primaryAction: "answer" | "accept" | "review" | "resolve" | "reconnect";
  secondaryActions?: Array<"deny" | "edit" | "view_source" | "answer_only">;
  createdAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function getNeedsYouItems(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const { service, organizationId, userId, isAdmin } = input;
  let questionsQuery = service
    .from("employee_questions")
    .select("id,question,created_at,assigned_expert_id")
    .eq("organization_id", organizationId)
    .eq("status", "needs_owner")
    .eq("escalated", true);
  if (!isAdmin)
    questionsQuery = questionsQuery.eq("assigned_expert_id", userId);

  const [
    questions,
    proposals,
    processes,
    conflicts,
    freshness,
    feedback,
    integrations,
  ] = await Promise.all([
    questionsQuery.order("created_at", { ascending: false }),
    isAdmin
      ? service
          .from("knowledge_proposals")
          .select(
            "id,title,proposed_content,proposal_type,source_type,source_label,status,risk_level,review_reason,related_process_id,created_at,version,updated_at,existing_knowledge_id",
          )
          .eq("organization_id", organizationId)
          .in("status", ["pending_approval", "needs_review"])
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("processes")
          .select(
            "id,title,summary,source_provider,source_title,criticality,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("status", "needs_review")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("knowledge_conflicts")
          .select(
            "id,knowledge_chunk_a,knowledge_chunk_b,conflict_type,explanation,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("status", "open")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("knowledge_chunks")
          .select(
            "id,content,source_type,process_id,updated_at,approved,criticality,health_status,last_confirmed_at,source_modified_at,created_at,current_version",
          )
          .eq("organization_id", organizationId)
          .eq("approved", true)
          .neq("health_status", "conflict")
          .order("last_confirmed_at", { ascending: true, nullsFirst: true })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("knowledge_feedback")
          .select("id,reason,note,knowledge_chunk_id,question_id,created_at")
          .eq("organization_id", organizationId)
          .eq("feedback_type", "not_right")
          .eq("status", "open")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("integrations")
          .select("id,provider,status,external_account_name,updated_at")
          .eq("organization_id", organizationId)
          .in("status", ["needs_reauthorization", "error"])
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = [
    questions.error,
    proposals.error,
    processes.error,
    conflicts.error,
    freshness.error,
    feedback.error,
    integrations.error,
  ].find(Boolean);
  if (firstError) throw firstError;
  const conflictKnowledgeIds = [
    ...new Set([
      ...(proposals.data ?? [])
        .map((p) => p.existing_knowledge_id)
        .filter(Boolean),
      ...(conflicts.data ?? []).flatMap((item) => [
        item.knowledge_chunk_a,
        item.knowledge_chunk_b,
      ]),
    ]),
  ];
  const conflictKnowledge = conflictKnowledgeIds.length
    ? await service
        .from("knowledge_chunks")
        .select("id,content,current_version")
        .eq("organization_id", organizationId)
        .in("id", conflictKnowledgeIds)
    : { data: [], error: null };
  if (conflictKnowledge.error) throw conflictKnowledge.error;
  const conflictContent = new Map(
    (conflictKnowledge.data ?? []).map((item) => [item.id, item.content]),
  );

  const items: NeedsYouItem[] = [
    ...(questions.data ?? []).map((question) => ({
      id: `question-${question.id}`,
      type: "question" as const,
      kind: "answer" as const,
      priority: "now" as const,
      title: "A teammate needs guidance",
      summary: question.question,
      detail:
        "Opryn could not find an approved answer. Your response can answer them now, then you can choose whether Opryn should remember it.",
      source: "Employee question",
      targetId: question.id,
      targetUrl: `/app/needs-you?item=question-${question.id}`,
      primaryAction: "answer" as const,
      secondaryActions: ["answer_only" as const],
      createdAt: question.created_at,
    })),
    ...(proposals.data ?? []).map((proposal) => {
      const mustReview =
        proposal.status === "needs_review" ||
        Boolean(proposal.existing_knowledge_id);
      return {
        id: `proposal-${proposal.id}`,
        type: "knowledge_proposal" as const,
        kind: "approve" as const,
        priority:
          proposal.risk_level === "critical"
            ? ("now" as const)
            : ("soon" as const),
        title: proposal.title,
        summary: proposal.proposed_content,
        detail:
          proposal.review_reason ||
          "Accept makes this available to people and AI connections with access. Deny keeps it out of official knowledge.",
        source: proposal.source_label,
        targetId: proposal.id,
        targetUrl:
          proposal.status === "needs_review"
            ? proposal.related_process_id
              ? `/app/processes/${proposal.related_process_id}?review=true&returnTo=%2Fapp%2Fneeds-you`
              : `/app/needs-you?item=proposal-${proposal.id}`
            : `/app/needs-you?item=proposal-${proposal.id}`,
        primaryAction: mustReview ? ("review" as const) : ("accept" as const),
        secondaryActions: mustReview
          ? (["edit", "deny"] as Array<"edit" | "deny">)
          : (["deny", "edit"] as Array<"edit" | "deny">),
        createdAt: proposal.created_at,
        metadata: {
          version: proposal.version,
          updatedAt: proposal.updated_at,
          proposalType: proposal.proposal_type,
          riskLevel: proposal.risk_level,
          reviewRequired: proposal.status === "needs_review",
          currentContent:
            conflictContent.get(proposal.existing_knowledge_id) ?? null,
          knowledgeVersion:
            (conflictKnowledge.data ?? []).find(
              (k) => k.id === proposal.existing_knowledge_id,
            )?.current_version ?? null,
          relatedProcessId: proposal.related_process_id,
        },
      };
    }),
    ...(processes.data ?? []).map((process) => ({
      id: `process-${process.id}`,
      type: "process" as const,
      kind: "approve" as const,
      priority:
        process.criticality === "critical"
          ? ("now" as const)
          : ("soon" as const),
      title: process.title,
      summary: process.summary || "A structured process is ready for review.",
      detail:
        "Review the steps, rules, responsibilities, and any clarifications before this process becomes official.",
      source:
        process.source_title || sourceName(process.source_provider) || "Opryn",
      targetId: process.id,
      targetUrl: `/app/processes/${process.id}?review=true&returnTo=%2Fapp%2Fneeds-you`,
      primaryAction: "review" as const,
      secondaryActions: ["edit" as const],
      createdAt: process.created_at,
      metadata: { riskLevel: process.criticality },
    })),
    ...(conflicts.data ?? []).map((conflict) => ({
      id: `conflict-${conflict.id}`,
      type: "conflict" as const,
      kind: "conflict" as const,
      priority: "now" as const,
      title:
        conflict.conflict_type === "possible_duplicate"
          ? "Possible duplicate knowledge"
          : "Company guidance conflicts",
      summary:
        conflict.explanation ||
        "Opryn found two approved answers that may disagree.",
      detail:
        "Choose the supported version. A process containing a withdrawn rule will need review before it is used again.",
      source: "Company Knowledge",
      targetId: conflict.id,
      targetUrl: `/app/needs-you?item=conflict-${conflict.id}`,
      primaryAction: "resolve" as const,
      createdAt: conflict.created_at,
      metadata: {
        conflictType: conflict.conflict_type,
        firstKnowledgeId: conflict.knowledge_chunk_a,
        secondKnowledgeId: conflict.knowledge_chunk_b,
        firstContent: conflictContent.get(conflict.knowledge_chunk_a) ?? null,
        secondContent: conflictContent.get(conflict.knowledge_chunk_b) ?? null,
      },
    })),
    ...(feedback.data ?? []).map((item) => ({
      id: `feedback-${item.id}`,
      type: "feedback" as const,
      kind: "update" as const,
      priority: "soon" as const,
      title: "An answer was marked Not Right",
      summary:
        item.note ||
        feedbackReason(item.reason) ||
        "Review the answer and its source.",
      detail:
        "Check the underlying knowledge before marking this feedback resolved.",
      source: "Team feedback",
      targetId: item.id,
      targetUrl: `/app/needs-you?item=feedback-${item.id}`,
      primaryAction: "review" as const,
      createdAt: item.created_at,
      metadata: {
        knowledgeId: item.knowledge_chunk_id,
        questionId: item.question_id,
      },
    })),
    ...(freshness.data ?? [])
      .filter(
        (item) =>
          !conflictKnowledgeIds.includes(item.id) && freshnessReason(item),
      )
      .map((item) => ({
        id: `freshness-${item.id}`,
        type: "freshness" as const,
        kind: "update" as const,
        priority: "can_wait" as const,
        title: "Is this still accurate?",
        summary: item.content,
        detail: `${freshnessReason(item)}. Confirm it is still accurate or review the source. Confirmation does not rewrite policy.`,
        source: sourceName(item.source_type) || "Company Knowledge",
        targetId: item.id,
        targetUrl: `/app/needs-you?item=freshness-${item.id}`,
        primaryAction: "review" as const,
        createdAt: item.updated_at,
        metadata: {
          version: item.current_version,
          processId: item.process_id,
          lastConfirmedAt: item.last_confirmed_at,
        },
      })),
    ...(integrations.data ?? []).map((item) => ({
      id: `integration-${item.id}`,
      type: "integration" as const,
      kind: "update" as const,
      priority: "soon" as const,
      title: `${sourceName(item.provider) || item.provider} needs attention`,
      summary:
        item.status === "needs_reauthorization"
          ? "Reconnect this tool so Opryn can keep using it."
          : "This connection could not complete its latest action.",
      detail: item.external_account_name
        ? `Connected account: ${item.external_account_name}`
        : undefined,
      source: "Integration",
      targetId: item.id,
      targetUrl: `/app/integrations?provider=${encodeURIComponent(item.provider)}`,
      primaryAction: "reconnect" as const,
      createdAt: item.updated_at,
    })),
  ];
  return items.toSorted((left, right) => {
    const rank = { now: 0, soon: 1, can_wait: 2 };
    return (
      rank[left.priority] - rank[right.priority] ||
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

export function summarizeNeedsYou(items: NeedsYouItem[]) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.kind] += 1;
      return summary;
    },
    { total: 0, answer: 0, approve: 0, conflict: 0, update: 0 },
  );
}

function sourceName(value: string | null) {
  if (!value) return null;
  const names: Record<string, string> = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    external_ai: "Connected AI",
    google_drive: "Google Drive",
    call_finding: "Call",
    slack: "Slack",
    teams: "Microsoft Teams",
  };
  return names[value] || value.replaceAll("_", " ");
}

function feedbackReason(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    outdated: "The source may be outdated.",
    wrong_policy: "The answer may use the wrong policy.",
    missing_information: "The answer is missing important information.",
    didnt_answer: "The answer did not address the question.",
    other: "The teammate added feedback for review.",
  };
  return labels[value] || null;
}
