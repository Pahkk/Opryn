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
  const { service, organizationId, userId, processId } = input;
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
        "id,title,summary,purpose,learning_source,source_provider,source_title,criticality,library_archived_at",
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
  const importedFromDrive = process.learning_source === "google_drive";
  const roleId =
    rolesResult.data?.length === 1 ? rolesResult.data[0].role_id : null;
  const chunks = [
    {
      content: `${process.title}. ${process.summary}\nPurpose: ${process.purpose}`,
      source_type: importedFromDrive ? "google_drive" : "process_summary",
      source_id: process.id,
      process_id: processId,
      rule_id: null,
    },
    ...(stepsResult.data ?? []).map((step) => ({
      content: `${process.title}, step ${step.step_order}: ${step.title}. ${step.description}`,
      source_type: importedFromDrive ? "google_drive" : "process_step",
      source_id: step.id,
      process_id: processId,
      rule_id: null,
    })),
    ...(rulesResult.data ?? []).map((rule) => ({
      content: `${rule.title}: ${rule.text}`,
      source_type: importedFromDrive ? "google_drive" : "rule",
      source_id: rule.id,
      process_id: processId,
      rule_id: rule.id,
    })),
    ...(exceptionsResult.data ?? []).map((item) => ({
      content: `${process.title} exception: ${item.text}`,
      source_type: importedFromDrive ? "google_drive" : "exception",
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
  const now = new Date().toISOString();
  const activeChunkIds: string[] = [];
  for (const [index, nextChunk] of chunks.entries()) {
    const existing = (existingChunks ?? []).find(
      (item) =>
        item.source_id === nextChunk.source_id &&
        item.source_type === nextChunk.source_type,
    );
    if (existing) {
      const changed = existing.content !== nextChunk.content;
      const nextVersion = changed
        ? (existing.current_version ?? 1) + 1
        : (existing.current_version ?? 1);
      if (changed)
        await service.from("knowledge_versions").upsert(
          {
            organization_id: organizationId,
            knowledge_chunk_id: existing.id,
            version_number: existing.current_version ?? 1,
            title: process.title,
            content: existing.content,
            changed_by: userId,
            change_reason: "Previous approved process version",
          },
          {
            onConflict: "knowledge_chunk_id,version_number",
            ignoreDuplicates: true,
          },
        );
      const { error } = await service
        .from("knowledge_chunks")
        .update({
          ...nextChunk,
          role_id: roleId,
          approved: true,
          embedding: embeddings[index],
          current_version: nextVersion,
          last_confirmed_at: now,
          health_status: "healthy",
          criticality: process.criticality,
        })
        .eq("id", existing.id)
        .eq("organization_id", organizationId);
      if (error) throw error;
      activeChunkIds.push(existing.id);
      if (changed) {
        const { error: versionError } = await service
          .from("knowledge_versions")
          .insert({
            organization_id: organizationId,
            knowledge_chunk_id: existing.id,
            version_number: nextVersion,
            title: process.title,
            content: nextChunk.content,
            changed_by: userId,
            change_reason: "Process reapproved",
          });
        if (versionError) throw versionError;
        await service.from("knowledge_events").insert({
          organization_id: organizationId,
          event_type: "knowledge_updated",
          actor_id: userId,
          knowledge_chunk_id: existing.id,
          metadata: { version: nextVersion, process_id: processId },
        });
      }
    } else {
      const { data: inserted, error } = await service
        .from("knowledge_chunks")
        .insert({
          ...nextChunk,
          organization_id: organizationId,
          role_id: roleId,
          approved: true,
          embedding: embeddings[index],
          current_version: 1,
          last_confirmed_at: now,
          health_status: "healthy",
          criticality: process.criticality,
        })
        .select("id")
        .single();
      if (error) throw error;
      activeChunkIds.push(inserted.id);
      const { error: versionError } = await service
        .from("knowledge_versions")
        .insert({
          organization_id: organizationId,
          knowledge_chunk_id: inserted.id,
          version_number: 1,
          title: process.title,
          content: nextChunk.content,
          changed_by: userId,
          change_reason: "Process approved",
        });
      if (versionError) throw versionError;
    }
  }
  const retiredChunkIds = (existingChunks ?? [])
    .filter((item) => !activeChunkIds.includes(item.id))
    .map((item) => item.id);
  if (retiredChunkIds.length) {
    const { error } = await service
      .from("knowledge_chunks")
      .update({ approved: false, health_status: "needs_review" })
      .in("id", retiredChunkIds)
      .eq("organization_id", organizationId);
    if (error) throw error;
  }
  const { error: processError } = await service
    .from("processes")
    .update({ status: "approved", approved_by: userId, approved_at: now })
    .eq("id", processId)
    .eq("organization_id", organizationId);
  if (processError) throw processError;
  const { error: ruleError } = await service
    .from("process_rules")
    .update({ status: "approved", approved_by: userId, approved_at: now })
    .eq("process_id", processId)
    .eq("organization_id", organizationId);
  if (ruleError) throw ruleError;
  const { data: processProposals, error: proposalReadError } = await service
    .from("knowledge_proposals")
    .select("id,process_rule_id")
    .eq("organization_id", organizationId)
    .eq("related_process_id", processId)
    .in("status", ["pending_approval", "needs_review"]);
  // Older workspaces can approve processes before the proposal migration is
  // present. Once present, the proposal and process approval views must stay
  // synchronized and reference the same approved chunks.
  if (proposalReadError && proposalReadError.code !== "42P01")
    throw proposalReadError;
  if (processProposals?.length) {
    const { data: approvedRuleChunks, error: chunkReadError } = await service
      .from("knowledge_chunks")
      .select("id,rule_id")
      .eq("organization_id", organizationId)
      .eq("process_id", processId)
      .eq("approved", true)
      .not("rule_id", "is", null);
    if (chunkReadError) throw chunkReadError;
    const chunkByRule = new Map(
      (approvedRuleChunks ?? []).map((chunk) => [chunk.rule_id, chunk.id]),
    );
    for (const proposal of processProposals) {
      const knowledgeId = proposal.process_rule_id
        ? chunkByRule.get(proposal.process_rule_id)
        : null;
      const { error } = await service
        .from("knowledge_proposals")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: now,
          approved_knowledge_id: knowledgeId ?? null,
        })
        .eq("organization_id", organizationId)
        .eq("id", proposal.id)
        .in("status", ["pending_approval", "needs_review"]);
      if (error) throw error;
    }
    const proposalIds = processProposals.map((proposal) => proposal.id);
    const { error: proposalNotificationError } = await service
      .from("notifications")
      .update({ read: true })
      .eq("organization_id", organizationId)
      .eq("entity_type", "knowledge_proposal")
      .in("entity_id", proposalIds);
    if (proposalNotificationError) throw proposalNotificationError;
  }
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
  let memberQuery = service
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("permission_level", "employee");
  if (roleId) memberQuery = memberQuery.eq("role_id", roleId);
  const { data: members, error: membersError } = await memberQuery;
  if (membersError) throw membersError;
  if (members?.length) {
    const { error } = await service.from("training_assignments").upsert(
      members.map((member) => ({
        organization_id: organizationId,
        user_id: member.user_id,
        process_id: processId,
        status: "assigned",
      })),
      { onConflict: "user_id,process_id", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
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
