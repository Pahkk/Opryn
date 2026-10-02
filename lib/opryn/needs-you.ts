import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { freshnessReason } from "@/lib/opryn/knowledge/health-model";
import {
  knowledgeScopeSchema,
  knowledgeScopesOverlap,
} from "@/lib/opryn/knowledge/scope";

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
    | "gap_recheck"
    | "external_question"
    | "integration"
    | "agent_test"
    | "training_review";
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
    .select("id,question,created_at,assigned_expert_id,cluster_id,origin")
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
    rechecks,
    externalQuestions,
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
            "id,title,summary,source_provider,source_title,supersedes_process_id,criticality,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("status", "needs_review")
          .is("library_archived_at", null)
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
    isAdmin
      ? service
          .from("knowledge_gap_rechecks")
          .select("proposal_id,status,created_at")
          .eq("organization_id", organizationId)
          .neq("status", "answered")
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    isAdmin
      ? service
          .from("external_ai_escalations")
          .select(
            "id,connection_id,question,context,resolution,proposed_rule,is_one_time_exception,knowledge_proposal_id,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("status", "open")
          .eq("escalated", true)
          .order("created_at", { ascending: false })
      : service
          .from("external_ai_escalations")
          .select(
            "id,connection_id,question,context,resolution,proposed_rule,is_one_time_exception,knowledge_proposal_id,created_at",
          )
          .eq("organization_id", organizationId)
          .eq("assigned_to", userId)
          .eq("status", "open")
          .eq("escalated", true)
          .order("created_at", { ascending: false }),
  ]);
  const firstError = [
    questions.error,
    proposals.error,
    processes.error,
    conflicts.error,
    freshness.error,
    feedback.error,
    integrations.error,
    rechecks.error,
    externalQuestions.error,
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
        .select("id,content,current_version,scope")
        .eq("organization_id", organizationId)
        .in("id", conflictKnowledgeIds)
    : { data: [], error: null };
  if (conflictKnowledge.error) throw conflictKnowledge.error;
  const conflictContent = new Map(
    (conflictKnowledge.data ?? []).map((item) => [item.id, item.content]),
  );
  const conflictVersions = new Map(
    (conflictKnowledge.data ?? []).map((item) => [
      item.id,
      item.current_version,
    ]),
  );
  const conflictScopes = new Map(
    (conflictKnowledge.data ?? []).map((item) => [
      item.id,
      knowledgeScopeSchema.parse(item.scope),
    ]),
  );
  const gapIds = [
    ...new Set((questions.data ?? []).map((q) => q.cluster_id).filter(Boolean)),
  ];
  const gapFacts =
    isAdmin && gapIds.length
      ? await service
          .from("company_knowledge_gaps")
          .select(
            "id,question_count,unique_source_count,human_interruption_count",
          )
          .eq("organization_id", organizationId)
          .in("id", gapIds)
      : { data: [], error: null };
  if (gapFacts.error) throw gapFacts.error;
  const gapById = new Map((gapFacts.data ?? []).map((gap) => [gap.id, gap]));
  const stalledRechecks = new Map<
    string,
    { count: number; unknown: boolean; createdAt: string }
  >();
  for (const recheck of rechecks.data ?? []) {
    if (
      recheck.status === "pending" &&
      Date.now() - Date.parse(recheck.created_at) < 300_000
    )
      continue;
    const entry = stalledRechecks.get(recheck.proposal_id) ?? {
      count: 0,
      unknown: false,
      createdAt: recheck.created_at,
    };
    entry.count += 1;
    entry.unknown ||= recheck.status === "unknown";
    stalledRechecks.set(recheck.proposal_id, entry);
  }

  const items: NeedsYouItem[] = [
    ...(externalQuestions.data ?? []).map((question) => ({
      id: `external-question-${question.id}`,
      type: "external_question" as const,
      kind: "answer" as const,
      priority: "now" as const,
      title: "Connected AI · Needs an answer",
      summary: question.question,
      source: "Connected AI",
      targetId: question.id,
      detail:
        "Answer this connection’s question once, or propose reusable guidance. Nothing is published without approval.",
      targetUrl: `/app/ai-connections/${question.connection_id}?tab=escalations`,
      primaryAction: "review" as const,
      createdAt: question.created_at,
      metadata: {
        connectionId: question.connection_id,
        context: question.context,
        resolution: question.resolution,
        proposedRule: question.proposed_rule,
        oneTimeException: question.is_one_time_exception,
        proposalId: question.knowledge_proposal_id,
      },
    })),
    ...[...stalledRechecks].map(([proposalId, facts]) => ({
      id: `gap-recheck-${proposalId}`,
      type: "gap_recheck" as const,
      kind: "update" as const,
      priority: "soon" as const,
      title: "Knowledge gap · Check the answer",
      summary: facts.unknown
        ? "The approved answer doesn't yet cover every recorded question."
        : "The approved answer is saved. Opryn couldn't finish checking the original questions.",
      detail: `${facts.count} recorded question${facts.count === 1 ? "" : "s"} still need a sourced answer. Recheck, or teach more detail. Approval remains intact; the gap stays open until verified.`,
      targetId: proposalId,
      targetUrl: `/app/needs-you?item=gap-recheck-${proposalId}`,
      primaryAction: "review" as const,
      createdAt: facts.createdAt,
    })),
    ...(questions.data ?? []).map((question) => {
      const gap = gapById.get(question.cluster_id);
      return {
        id: `question-${question.id}`,
        type: "question" as const,
        kind: "answer" as const,
        priority: "now" as const,
        title: "Knowledge gap · Needs an answer",
        metadata: {
          questionCount: gap?.question_count ?? null,
          channelCount: gap?.unique_source_count ?? null,
          humanInterruptions: gap?.human_interruption_count ?? null,
        },
        summary: question.question,
        detail:
          "Opryn could not find an approved answer. Answer this question once, or propose reusable guidance for human review." +
          (gap
            ? ` This gap has been asked ${gap.question_count} times; recorded across ${gap.unique_source_count} channels and sent to a human ${gap.human_interruption_count} times.`
            : ""),
        source:
          question.origin === "teams"
            ? "Microsoft Teams"
            : question.origin === "slack"
              ? "Slack"
              : question.origin === "external_ai"
                ? "Connected AI"
                : "Ask Opryn",
        targetId: question.id,
        targetUrl: `/app/needs-you?item=question-${question.id}`,
        primaryAction: "answer" as const,
        secondaryActions: ["answer_only" as const],
        createdAt: question.created_at,
      };
    }),
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
          existingKnowledgeId: proposal.existing_knowledge_id,
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
      kind: process.supersedes_process_id
        ? ("update" as const)
        : ("approve" as const),
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
      metadata: {
        riskLevel: process.criticality,
        sourceUpdate: Boolean(process.supersedes_process_id),
        previousProcessId: process.supersedes_process_id,
      },
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
        firstVersion: conflictVersions.get(conflict.knowledge_chunk_a),
        firstApplicability: Object.entries(
          conflictScopes.get(conflict.knowledge_chunk_a) ?? {},
        )
          .map(
            ([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(", ") : value}`,
          )
          .join(" · "),
        secondVersion: conflictVersions.get(conflict.knowledge_chunk_b),
        separateScopes: !knowledgeScopesOverlap(
          conflictScopes.get(conflict.knowledge_chunk_a) ?? {},
          conflictScopes.get(conflict.knowledge_chunk_b) ?? {},
        ),
        firstContent: conflictContent.get(conflict.knowledge_chunk_a) ?? null,
        secondContent: conflictContent.get(conflict.knowledge_chunk_b) ?? null,
      },
    })),
    ...(feedback.data ?? []).map((item) => ({
      id: `feedback-${item.id}`,
      type: "feedback" as const,
      kind: "update" as const,
      priority: "soon" as const,
      title: item.question_id
        ? "An answer was marked Not Right"
        : "Training guidance needs review",
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
  if (isAdmin) {
    const trainingReview = await service
      .from("training_scenarios")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "update_required");
    if (trainingReview.error) throw trainingReview.error;
    if (trainingReview.count)
      items.push({
        id: "training-review",
        type: "training_review",
        kind: "update",
        priority: "soon",
        title: "Updated knowledge needs practice review",
        summary: `${trainingReview.count} scenarios reference changed guidance. Review the affected exercises once for everyone who needs them.`,
        targetId: organizationId,
        targetUrl: "/app/training?view=roles",
        primaryAction: "review",
        createdAt: new Date().toISOString(),
      });
    const evaluationIssues = await service
      .from("knowledge_test_cases")
      .select(
        "id,title,connection_id,last_result,last_agent_result,agent_response_required,last_run_at",
      )
      .eq("organization_id", organizationId)
      .not("connection_id", "is", null)
      .is("retired_at", null)
      .or(
        "last_result->>trainingStatus.in.(failed,review,knowledge_gap),last_agent_result->>trainingStatus.in.(failed,review,knowledge_gap)",
      )
      .limit(50);
    if (evaluationIssues.error) throw evaluationIssues.error;
    for (const test of evaluationIssues.data ?? []) {
      const result = test.agent_response_required
        ? test.last_agent_result
        : test.last_result;
      if (
        !["failed", "review", "knowledge_gap"].includes(result?.trainingStatus)
      )
        continue;
      items.push({
        id: `agent-test-${test.id}`,
        type: "agent_test",
        kind: "update",
        priority: "soon",
        title:
          result?.trainingStatus === "knowledge_gap"
            ? "Agent evaluation revealed a knowledge gap"
            : "Agent evaluation needs review",
        summary: test.title,
        detail:
          result?.failureReason ??
          result?.explanation ??
          "Review the expected behavior and approved sources.",
        source: "Training evaluation",
        targetId: test.id,
        targetUrl: `/app/training?view=agents#agent-${test.connection_id}`,
        primaryAction: "review",
        createdAt: test.last_run_at ?? new Date().toISOString(),
      });
    }
  }
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
