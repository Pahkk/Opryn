import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedKnowledge } from "@/lib/ai/services";
import { classifyKnowledge } from "@/lib/knowledge-library";

const HIGH_RISK_PATTERN =
  /\b(pric(?:e|ing)|refund|legal|contract|discount|safety|compliance|payment|deposit|guarantee|financial approval)\b/i;

export type KnowledgeProposalStatus =
  "pending_approval" | "needs_review" | "approved" | "rejected" | "answer_only";

export type KnowledgeProposalSource =
  | "chatgpt"
  | "claude"
  | "external_ai"
  | "owner_answer"
  | "google_drive"
  | "call"
  | "document";

type ProposalRow = {
  id: string;
  organization_id: string;
  proposal_type: "policy" | "rule" | "faq" | "decision" | "exception";
  title: string;
  proposed_content: string;
  source_type: KnowledgeProposalSource;
  source_label: string;
  source_id: string | null;
  related_question_id: string | null;
  related_process_id: string | null;
  process_rule_id: string | null;
  existing_knowledge_id: string | null;
  approved_knowledge_id: string | null;
  risk_level: "normal" | "critical";
  review_reason: string | null;
  status: KnowledgeProposalStatus;
  version: number;
  updated_at: string;
};

export type ProposalActionResult = {
  id: string;
  title: string;
  content: string;
  status: KnowledgeProposalStatus;
  knowledgeId?: string;
};

export async function createKnowledgeProposalsForProcess(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  processId: string;
  sourceType: "chatgpt" | "claude" | "external_ai";
  sourceLabel: string;
}) {
  const {
    service,
    organizationId,
    userId,
    processId,
    sourceType,
    sourceLabel,
  } = input;
  const [rulesResult, clarificationsResult] = await Promise.all([
    service
      .from("process_rules")
      .select("id,title,text,confidence")
      .eq("organization_id", organizationId)
      .eq("process_id", processId),
    service
      .from("clarification_questions")
      .select("id,status,answer")
      .eq("organization_id", organizationId)
      .eq("process_id", processId),
  ]);
  const error = rulesResult.error ?? clarificationsResult.error;
  if (error) throw error;
  const hasUnresolvedClarification = (clarificationsResult.data ?? []).some(
    (item) => item.status !== "answered" || !item.answer?.trim(),
  );
  const proposals = [];
  for (const rule of rulesResult.data ?? []) {
    const highRisk = HIGH_RISK_PATTERN.test(`${rule.title} ${rule.text}`);
    const needsReview =
      highRisk &&
      (hasUnresolvedClarification || Number(rule.confidence ?? 0) < 0.82);
    proposals.push(
      await createKnowledgeProposal({
        service,
        organizationId,
        userId,
        proposalType: "policy",
        title: rule.title,
        content: rule.text,
        sourceType,
        sourceLabel,
        sourceId: processId,
        relatedProcessId: processId,
        processRuleId: rule.id,
        riskLevel: highRisk ? "critical" : "normal",
        status: needsReview ? "needs_review" : "pending_approval",
        reviewReason: needsReview
          ? "This high-impact policy has missing or low-confidence context and needs individual review."
          : null,
      }),
    );
  }
  return proposals;
}

export async function createKnowledgeProposal(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  proposalType?: ProposalRow["proposal_type"];
  title: string;
  content: string;
  sourceType: KnowledgeProposalSource;
  sourceLabel: string;
  sourceId?: string | null;
  relatedQuestionId?: string | null;
  relatedProcessId?: string | null;
  processRuleId?: string | null;
  existingKnowledgeId?: string | null;
  riskLevel?: "normal" | "critical";
  status?: "pending_approval" | "needs_review";
  reviewReason?: string | null;
}) {
  const titleNeedle = input.title
    .trim()
    .replace(/[%_]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  const relatedKnowledge =
    titleNeedle.length >= 4
      ? await input.service
          .from("knowledge_chunks")
          .select("id,content")
          .eq("organization_id", input.organizationId)
          .eq("approved", true)
          .ilike("content", `%${titleNeedle}%`)
          .limit(5)
      : { data: [], error: null };
  if (relatedKnowledge.error) throw relatedKnowledge.error;
  const conflictingKnowledge = (relatedKnowledge.data ?? []).find((item) =>
    numericConflict(item.content, input.content),
  );
  const status = conflictingKnowledge ? "needs_review" : input.status;
  const reviewReason = conflictingKnowledge
    ? "This proposal appears to use a different limit than existing approved knowledge. Resolve the conflict before approval."
    : input.reviewReason;
  const contentHash = createHash("sha256")
    .update(
      [
        input.organizationId,
        input.proposalType ?? "policy",
        normalize(input.title),
        normalize(input.content),
      ].join("\u001f"),
    )
    .digest("hex");
  const { data: existing, error: existingError } = await input.service
    .from("knowledge_proposals")
    .select(
      "id,title,proposed_content,status,risk_level,review_reason,source_label,related_process_id,version,updated_at",
    )
    .eq("organization_id", input.organizationId)
    .eq("content_hash", contentHash)
    .in("status", ["pending_approval", "needs_review"])
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return proposalSummary(existing);

  const { data: proposal, error } = await input.service
    .from("knowledge_proposals")
    .insert({
      organization_id: input.organizationId,
      proposal_type: input.proposalType ?? "policy",
      title: input.title,
      library_category: input.proposalType
        ? input.proposalType === "rule"
          ? "policy"
          : input.proposalType
        : classifyKnowledge(input.title),
      proposed_content: input.content,
      source_type: input.sourceType,
      source_label: input.sourceLabel,
      source_id: input.sourceId ?? null,
      related_question_id: input.relatedQuestionId ?? null,
      related_process_id: input.relatedProcessId ?? null,
      process_rule_id: input.processRuleId ?? null,
      existing_knowledge_id:
        input.existingKnowledgeId ?? conflictingKnowledge?.id ?? null,
      risk_level: input.riskLevel ?? "normal",
      status: status ?? "pending_approval",
      review_reason: reviewReason ?? null,
      content_hash: contentHash,
      created_by: input.userId,
    })
    .select(
      "id,title,proposed_content,status,risk_level,review_reason,source_label,related_process_id,version,updated_at",
    )
    .single();
  if (error) {
    // A concurrent learning request may have inserted the same active proposal.
    if (error.code === "23505") {
      const { data: duplicate, error: duplicateError } = await input.service
        .from("knowledge_proposals")
        .select(
          "id,title,proposed_content,status,risk_level,review_reason,source_label,related_process_id,version,updated_at",
        )
        .eq("organization_id", input.organizationId)
        .eq("content_hash", contentHash)
        .in("status", ["pending_approval", "needs_review"])
        .single();
      if (duplicateError) throw duplicateError;
      return proposalSummary(duplicate);
    }
    throw error;
  }
  await Promise.all([
    input.service.from("knowledge_events").insert({
      organization_id: input.organizationId,
      event_type: "proposal_created",
      actor_id: input.userId,
      source_type: input.sourceType,
      source_id: proposal.id,
      metadata: {
        proposal_type: input.proposalType ?? "policy",
        risk_level: input.riskLevel ?? "normal",
        possible_conflict: Boolean(conflictingKnowledge),
        related_process_id: input.relatedProcessId ?? null,
      },
    }),
    notifyProposalReview(input.service, {
      organizationId: input.organizationId,
      proposalId: proposal.id,
      title: input.title,
      content: input.content,
      sourceLabel: input.sourceLabel,
      needsReview: proposal.status === "needs_review",
    }),
  ]);
  return proposalSummary(proposal);
}

type ProposalDecisionInput = {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  proposalId: string;
  expectedVersion: number;
  expectedUpdatedAt: string;
  expectedKnowledgeVersion?: number;
};

export async function approveKnowledgeProposal(
  input: ProposalDecisionInput & {
    approvalSource: "web" | "chatgpt" | "claude" | "external_ai";
  },
) {
  const proposal = await getProposalForResolution(input);
  assertDisplayedRevision(proposal, input);
  if (proposal.status !== "pending_approval")
    throw new ProposalResolutionError(
      "review_required",
      proposal.review_reason ||
        "This proposal needs review or was already resolved.",
    );
  const existing = proposal.existing_knowledge_id
    ? await input.service
        .from("knowledge_chunks")
        .select("current_version")
        .eq("organization_id", input.organizationId)
        .eq("id", proposal.existing_knowledge_id)
        .single()
    : { data: null, error: null };
  if (existing.error) throw existing.error;
  // Updates require a before/after review in the existing process editor.
  if (
    proposal.existing_knowledge_id &&
    existing.data?.current_version !== input.expectedKnowledgeVersion
  )
    throw new ProposalResolutionError(
      "review_required",
      "Review the current and suggested versions in Opryn before accepting this update.",
    );
  const [embedding] = await embedKnowledge([
    `${proposal.title}: ${proposal.proposed_content}`,
  ]);
  return decideProposal(
    input,
    "approved",
    input.approvalSource,
    embedding,
    undefined,
    input.expectedKnowledgeVersion,
  );
}

export async function rejectKnowledgeProposal(
  input: ProposalDecisionInput & {
    reason?: string;
    rejectionSource: "web" | "chatgpt" | "claude" | "external_ai";
    answerOnly?: boolean;
  },
) {
  const proposal = await getProposalForResolution(input);
  assertDisplayedRevision(proposal, input);
  return decideProposal(
    input,
    input.answerOnly ? "answer_only" : "rejected",
    input.rejectionSource,
    undefined,
    input.reason,
  );
}

function assertDisplayedRevision(
  proposal: ProposalRow,
  input: ProposalDecisionInput,
) {
  if (
    proposal.version !== input.expectedVersion ||
    proposal.updated_at !== input.expectedUpdatedAt
  )
    throw new ProposalResolutionError(
      "already_resolved",
      "This proposal changed. Review the latest revision before deciding.",
    );
}

async function decideProposal(
  input: ProposalDecisionInput,
  decision: string,
  source: string,
  embedding?: number[],
  reason?: string,
  knowledgeVersion?: number,
) {
  const { data, error } = await input.service.rpc("decide_knowledge_proposal", {
    target_organization_id: input.organizationId,
    target_proposal_id: input.proposalId,
    actor_id: input.userId,
    expected_version: input.expectedVersion,
    expected_updated_at: input.expectedUpdatedAt,
    decision,
    decision_source: source,
    prepared_embedding: embedding ?? null,
    rejection_reason: reason?.trim().slice(0, 1000) || null,
    expected_knowledge_version: knowledgeVersion ?? null,
  });
  if (error) {
    if (["40001", "23514", "P0002", "42501", "53300"].includes(error.code))
      throw new ProposalResolutionError(
        error.code === "P0002"
          ? "not_found"
          : error.code === "53300"
            ? "rate_limited"
            : error.code === "23514"
              ? "review_required"
              : "already_resolved",
        error.code === "53300"
          ? "Too many decisions. Try again shortly."
          : error.code === "42501"
            ? "Your access changed. Please sign in again."
            : "This proposal changed or requires review. Refresh to see the latest revision.",
      );
    throw error;
  }
  return data as ProposalActionResult;
}

async function getProposalForResolution(input: {
  service: SupabaseClient;
  organizationId: string;
  proposalId: string;
}) {
  const { data, error } = await input.service
    .from("knowledge_proposals")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.proposalId)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ProposalResolutionError("not_found", "Proposal not found.");
  return data as ProposalRow;
}

async function notifyProposalReview(
  service: SupabaseClient,
  input: {
    organizationId: string;
    proposalId: string;
    title: string;
    content: string;
    sourceLabel: string;
    needsReview: boolean;
  },
) {
  const { data: members, error } = await service
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", input.organizationId)
    .in("permission_level", ["owner", "admin"]);
  if (error) throw error;
  if (!members?.length) return;
  const targetUrl = `/app/needs-you?item=${input.proposalId}`;
  const { error: notificationError } = await service
    .from("notifications")
    .insert(
      members.map((member) => ({
        organization_id: input.organizationId,
        user_id: member.user_id,
        type: "rule_needs_approval",
        title: input.needsReview
          ? `${input.title} needs review`
          : `${input.title} needs approval`,
        body: `${input.sourceLabel}: ${input.content}`.slice(0, 4000),
        link: targetUrl,
        entity_type: "knowledge_proposal",
        entity_id: input.proposalId,
        action: input.needsReview ? "review" : "approve",
        target_url: targetUrl,
      })),
    );
  if (notificationError) throw notificationError;
}

function proposalSummary(proposal: {
  version: number;
  updated_at: string;
  id: string;
  title: string;
  proposed_content: string;
  status: string;
  risk_level: string;
  review_reason: string | null;
  source_label: string;
  related_process_id: string | null;
}) {
  return {
    id: proposal.id,
    version: proposal.version,
    updatedAt: proposal.updated_at,
    title: proposal.title,
    content: proposal.proposed_content,
    status: proposal.status as "pending_approval" | "needs_review",
    riskLevel: proposal.risk_level as "normal" | "critical",
    reviewReason: proposal.review_reason,
    sourceLabel: proposal.source_label,
    reviewUrl: proposal.related_process_id
      ? `https://www.opryn.app/app/processes/${proposal.related_process_id}?review=true&returnTo=%2Fapp%2Fneeds-you`
      : `https://www.opryn.app/app/needs-you?item=${proposal.id}`,
  };
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function numericConflict(existing: string, proposed: string) {
  const numbers = (value: string) =>
    new Set(
      value
        .match(/\$?[0-9][0-9,.]*(?:%|\b)/g)
        ?.map((item) => item.replaceAll(",", "")) ?? [],
    );
  const current = numbers(existing);
  const next = numbers(proposed);
  return (
    current.size > 0 &&
    next.size > 0 &&
    [...current].some((value) => !next.has(value))
  );
}

export class ProposalResolutionError extends Error {
  code: "not_found" | "review_required" | "already_resolved" | "rate_limited";

  constructor(
    code: "not_found" | "review_required" | "already_resolved" | "rate_limited",
    message: string,
  ) {
    super(message);
    this.name = "ProposalResolutionError";
    this.code = code;
  }
}
