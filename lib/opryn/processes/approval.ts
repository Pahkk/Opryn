import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedKnowledge } from "@/lib/ai/services";
import { assertNoBlockingKnowledgeConflict } from "@/lib/opryn/knowledge/trust";
import { createServiceClient } from "@/lib/supabase/service";

const HIGH_RISK_PATTERN =
  /\b(pric(?:e|ing)|refund|legal|contract|discount|safety|compliance|payment|guarantee|financial approval)\b/i;

export type ProcessApprovalRisk = {
  critical: boolean;
  unresolvedClarifications: number;
  reasons: string[];
};

export async function assessProcessApprovalRisk(
  service: SupabaseClient,
  organizationId: string,
  processId: string,
): Promise<ProcessApprovalRisk> {
  const [processResult, rulesResult, exceptionsResult, clarificationsResult] =
    await Promise.all([
      service
        .from("processes")
        .select("title,summary,purpose,criticality")
        .eq("organization_id", organizationId)
        .eq("id", processId)
        .maybeSingle(),
      service
        .from("process_rules")
        .select("title,text")
        .eq("organization_id", organizationId)
        .eq("process_id", processId),
      service
        .from("process_exceptions")
        .select("text")
        .eq("organization_id", organizationId)
        .eq("process_id", processId),
      service
        .from("clarification_questions")
        .select("id,status,answer")
        .eq("organization_id", organizationId)
        .eq("process_id", processId),
    ]);
  const error = [
    processResult.error,
    rulesResult.error,
    exceptionsResult.error,
    clarificationsResult.error,
  ].find(Boolean);
  if (error) throw error;
  if (!processResult.data) throw new Error("Process not found.");
  const searchable = [
    processResult.data.title,
    processResult.data.summary,
    processResult.data.purpose,
    ...(rulesResult.data ?? []).flatMap((rule) => [rule.title, rule.text]),
    ...(exceptionsResult.data ?? []).map((item) => item.text),
  ].join("\n");
  const unresolvedClarifications = (clarificationsResult.data ?? []).filter(
    (item) => item.status !== "answered" || !item.answer?.trim(),
  ).length;
  const critical =
    processResult.data.criticality === "critical" ||
    HIGH_RISK_PATTERN.test(searchable);
  return {
    critical,
    unresolvedClarifications,
    reasons: [
      critical ? "This process includes high-risk company policy." : "",
      unresolvedClarifications
        ? `${unresolvedClarifications} clarification${unresolvedClarifications === 1 ? " is" : "s are"} unresolved.`
        : "",
    ].filter(Boolean),
  };
}

export async function approveProcessKnowledge(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  processId: string;
}) {
  const { service, organizationId, processId } = input;
  const [
    processResult,
    stepsResult,
    rulesResult,
    exceptionsResult,
    rolesResult,
  ] = await Promise.all([
    service
      .from("processes")
      .select(
        "id,title,summary,purpose,learning_source,source_provider,source_title,supersedes_process_id,criticality,library_archived_at,updated_at",
      )
      .eq("id", processId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    service
      .from("process_steps")
      .select("id,step_order,title,description")
      .eq("organization_id", organizationId)
      .eq("process_id", processId)
      .order("step_order"),
    service
      .from("process_rules")
      .select("id,title,text")
      .eq("organization_id", organizationId)
      .eq("process_id", processId),
    service
      .from("process_exceptions")
      .select("id,text")
      .eq("organization_id", organizationId)
      .eq("process_id", processId),
    service
      .from("process_role_assignments")
      .select("role_id")
      .eq("organization_id", organizationId)
      .eq("process_id", processId),
  ]);
  const readError = [
    processResult.error,
    stepsResult.error,
    rulesResult.error,
    exceptionsResult.error,
    rolesResult.error,
  ].find(Boolean);
  if (readError) throw readError;
  if (!processResult.data) throw new Error("Process not found.");
  const process = processResult.data;
  if (process.library_archived_at)
    throw new Error(
      "This process is archived. Teach a new version before approving it.",
    );
  const importedSource = ["google_drive", "notion", "confluence"].includes(
    process.learning_source,
  )
    ? process.learning_source
    : null;
  const chunks = [
    {
      content: `${process.title}. ${process.summary}\nPurpose: ${process.purpose}`,
      source_type: importedSource ?? "process_summary",
      source_id: process.id,
      process_id: processId,
      rule_id: null,
    },
    ...(stepsResult.data ?? []).map((step) => ({
      content: `${process.title}, step ${step.step_order}: ${step.title}. ${step.description}`,
      source_type: importedSource ?? "process_step",
      source_id: step.id,
      process_id: processId,
      rule_id: null,
    })),
    ...(rulesResult.data ?? []).map((rule) => ({
      content: `${rule.title}: ${rule.text}`,
      source_type: importedSource ?? "rule",
      source_id: rule.id,
      process_id: processId,
      rule_id: rule.id,
    })),
    ...(exceptionsResult.data ?? []).map((item) => ({
      content: `${process.title} exception: ${item.text}`,
      source_type: importedSource ?? "exception",
      source_id: item.id,
      process_id: processId,
      rule_id: null,
    })),
  ];
  const embeddings = await embedKnowledge(chunks.map((chunk) => chunk.content));
  const { data: existingChunks, error: existingError } = await service
    .from("knowledge_chunks")
    .select("id,source_id,source_type,content,current_version,health_status")
    .eq("process_id", processId)
    .eq("organization_id", organizationId);
  if (existingError) throw existingError;
  await assertNoBlockingKnowledgeConflict(
    service,
    organizationId,
    existingChunks ?? [],
  );
  const published = await service.rpc("publish_process_knowledge", {
    target_org: organizationId,
    target_process: processId,
    expected_updated_at: process.updated_at,
    expected_versions: Object.fromEntries(
      (existingChunks ?? []).map((item) => [item.id, item.current_version]),
    ),
    prepared_chunks: chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    })),
  });
  if (published.error) throw published.error;
  const now = String(published.data);
  if (process.learning_source === "ai_conversation") {
    // Job bookkeeping is server-owned. A normal owner session may approve
    // knowledge but cannot mutate worker jobs through its RLS-scoped client.
    const { error } = await createServiceClient()
      .from("external_learning_jobs")
      .update({ status: "complete", completed_at: now })
      .eq("process_id", processId)
      .eq("organization_id", organizationId);
    if (error) throw error;
  }
  // Training assignment is an explicit role/owner decision, never an approval side effect.
  const { error: notificationError } = await service
    .from("notifications")
    .update({ read: true })
    .eq("organization_id", organizationId)
    .eq("entity_type", "process")
    .eq("entity_id", processId);
  if (notificationError) throw notificationError;
  return { title: process.title, approvedAt: now };
}

export async function rejectProcessKnowledge(input: {
  service: SupabaseClient;
  organizationId: string;
  userId: string;
  processId: string;
  source: "web" | "chatgpt" | "claude" | "external_ai";
}) {
  const { service, organizationId, userId, processId, source } = input;
  const { data: process, error: processReadError } = await service
    .from("processes")
    .select("id,title,status")
    .eq("organization_id", organizationId)
    .eq("id", processId)
    .maybeSingle();
  if (processReadError) throw processReadError;
  if (!process) throw new Error("Process not found.");
  if (process.status === "approved")
    throw new Error("Approved processes must be edited or versioned in Opryn.");
  const now = new Date().toISOString();
  const [processUpdate, ruleUpdate, proposalUpdate, notificationUpdate] =
    await Promise.all([
      service
        .from("processes")
        .update({ status: "rejected", approved_by: null, approved_at: null })
        .eq("organization_id", organizationId)
        .eq("id", processId),
      service
        .from("process_rules")
        .update({ status: "rejected", approved_by: null, approved_at: null })
        .eq("organization_id", organizationId)
        .eq("process_id", processId),
      service
        .from("knowledge_proposals")
        .update({
          status: "rejected",
          rejected_by: userId,
          rejected_at: now,
          rejection_reason: "Parent process rejected",
        })
        .eq("organization_id", organizationId)
        .eq("related_process_id", processId)
        .in("status", ["pending_approval", "needs_review"]),
      service
        .from("notifications")
        .update({ read: true })
        .eq("organization_id", organizationId)
        .eq("entity_type", "process")
        .eq("entity_id", processId),
    ]);
  const error = [
    processUpdate.error,
    ruleUpdate.error,
    proposalUpdate.error,
    notificationUpdate.error,
  ].find(Boolean);
  if (error) throw error;
  const { data: rejectedProposals, error: rejectedProposalError } =
    await service
      .from("knowledge_proposals")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("related_process_id", processId)
      .eq("status", "rejected");
  if (rejectedProposalError) throw rejectedProposalError;
  if (rejectedProposals?.length) {
    const { error: proposalNotificationError } = await service
      .from("notifications")
      .update({ read: true })
      .eq("organization_id", organizationId)
      .eq("entity_type", "knowledge_proposal")
      .in(
        "entity_id",
        rejectedProposals.map((proposal) => proposal.id),
      );
    if (proposalNotificationError) throw proposalNotificationError;
  }
  await service.from("knowledge_events").insert({
    organization_id: organizationId,
    event_type: "knowledge_rejected",
    actor_id: userId,
    source_type: source,
    source_id: processId,
    metadata: { process_id: processId },
  });
  return { title: process.title, rejectedAt: now };
}
