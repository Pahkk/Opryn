import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENAI_MODELS } from "@/lib/ai/config";
import { extractProcessFromTranscript } from "@/lib/ai/services";
import { replaceExtractedProcess } from "@/lib/processes";
import type { McpAuthContext } from "@/lib/opryn/oauth/tokens";
import { createServiceClient } from "@/lib/supabase/service";
import { createKnowledgeProposalsForProcess } from "@/lib/opryn/knowledge/proposals";

export type ExternalLearningInput = {
  name: string;
  learningType: "business" | "process" | "topic";
  context: string;
  notes?: string;
  sourceTitle?: string;
};

export type ExternalLearningSummary = {
  processes: number;
  steps: number;
  rules: number;
  faqs: number;
  clarifications: number;
};

export async function createProcessFromContext(
  service: SupabaseClient,
  auth: McpAuthContext,
  input: Omit<ExternalLearningInput, "learningType">,
) {
  const started = await startExternalLearning(service, auth, {
    ...input,
    learningType: "process",
  });
  if (
    !started.processId ||
    !["needs_review", "complete"].includes(started.status)
  )
    await processExternalLearningJob(service, started.id);
  const { data: job, error } = await service
    .from("external_learning_jobs")
    .select("id,status,result_summary,process_id")
    .eq("id", started.id)
    .eq("organization_id", auth.organizationId)
    .single();
  if (error) throw error;
  const processId = job.process_id as string | null;
  if (!processId) throw new Error("Opryn could not create this process.");
  const summary = parseSummary(job.result_summary);
  const proposals = await listProcessKnowledgeProposals(
    service,
    auth.organizationId,
    processId,
  );
  return {
    status: job.status === "complete" ? "approved" : "needs_review",
    processId,
    summary,
    proposals,
    reviewUrl: `https://www.opryn.app/app/processes/${processId}?review=true&returnTo=%2Fapp%2Fprocesses`,
  };
}

export async function startExternalLearning(
  service: SupabaseClient,
  auth: McpAuthContext,
  input: ExternalLearningInput,
) {
  if (auth.permissionLevel !== "owner" && auth.permissionLevel !== "admin")
    throw new ExternalLearningPermissionError();

  const contentHash = createHash("sha256")
    .update(
      [
        auth.organizationId,
        auth.userId,
        auth.clientKind,
        input.learningType,
        normalizeForHash(input.name),
        normalizeForHash(input.context),
      ].join("\u001f"),
    )
    .digest("hex");
  const { data: existing, error: existingError } = await service
    .from("external_learning_jobs")
    .select("id,status,result_summary,process_id")
    .eq("organization_id", auth.organizationId)
    .eq("created_by", auth.userId)
    .eq("client_kind", auth.clientKind)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.status !== "failed") {
    const { error: touchError } = await service
      .from("external_learning_jobs")
      .update({ last_requested_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("organization_id", auth.organizationId);
    if (touchError) throw touchError;
    return {
      id: existing.id,
      status: existing.status,
      summary: parseSummary(existing.result_summary),
      processId: existing.process_id as string | null,
      duplicate: true,
    };
  }

  if (existing?.id) {
    const { error } = await service
      .from("external_learning_jobs")
      .update({
        status: "received",
        last_requested_at: new Date().toISOString(),
        context_text: input.context,
        notes: input.notes ?? null,
        source_title: input.sourceTitle ?? null,
        error_message: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", existing.id)
      .eq("organization_id", auth.organizationId);
    if (error) throw error;
    return {
      id: existing.id,
      status: "received" as const,
      summary: emptySummary(),
      processId: null,
      duplicate: false,
    };
  }

  const { data: job, error } = await service
    .from("external_learning_jobs")
    .insert({
      organization_id: auth.organizationId,
      created_by: auth.userId,
      grant_id: auth.grantId,
      client_kind: auth.clientKind,
      name: input.name,
      learning_type: input.learningType,
      context_text: input.context,
      notes: input.notes ?? null,
      source_title: input.sourceTitle ?? null,
      content_hash: contentHash,
      status: "received",
    })
    .select("id")
    .single();
  if (error) throw error;
  await service.from("onboarding_events").insert({
    organization_id: auth.organizationId,
    user_id: auth.userId,
    event_type: "learning_started",
    metadata: {
      source: auth.clientKind,
      learning_type: input.learningType,
      job_id: job.id,
    },
  });
  await service.from("onboarding_events").insert({
    organization_id: auth.organizationId,
    user_id: auth.userId,
    event_type: "external_ai_context_received",
    metadata: { source: auth.clientKind, job_id: job.id },
  });
  return {
    id: job.id as string,
    status: "received" as const,
    summary: emptySummary(),
    processId: null,
    duplicate: false,
  };
}

export async function processExternalLearningJob(
  service: SupabaseClient,
  jobId: string,
) {
  const { data: job, error: jobError } = await service
    .from("external_learning_jobs")
    .select(
      "id,organization_id,created_by,client_kind,name,learning_type,context_text,notes,source_title,status,process_id,started_at",
    )
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job || ["needs_review", "complete"].includes(job.status)) return;
  if (!job.context_text?.trim())
    throw new Error("This learning request no longer contains source context.");

  try {
    const startedAt = new Date().toISOString();
    await updateJob(service, job.id, {
      status: "processing",
      started_at: job.started_at ?? startedAt,
      error_message: null,
    });
    await service.from("onboarding_events").insert({
      organization_id: job.organization_id,
      user_id: job.created_by,
      event_type: "learning_processing_started",
      metadata: { job_id: job.id },
    });
    const sourceName = providerName(job.client_kind);
    let processId = job.process_id as string | null;
    if (!processId) {
      const { data: process, error } = await service
        .from("processes")
        .insert({
          organization_id: job.organization_id,
          title: preferredTitle(job.learning_type, job.name),
          description: `${sourceName} conversation explicitly sent to Opryn for review. Nothing from this source is approved automatically.`,
          created_by: job.created_by,
          learning_source: "ai_conversation",
          source_provider:
            job.client_kind === "custom_mcp" ? "external_ai" : job.client_kind,
          source_title: job.source_title || `${sourceName} conversation`,
        })
        .select("id")
        .single();
      if (error) throw error;
      processId = process.id;
      await updateJob(service, job.id, { process_id: processId });
    }
    if (!processId) throw new Error("Opryn could not prepare this review.");
    const activeProcessId = processId;

    await updateJob(service, job.id, { status: "extracting" });
    const extracted = await extractProcessFromTranscript(
      buildExtractionContext(job),
      preferredTitle(job.learning_type, job.name),
      { organizationId: job.organization_id, processId: activeProcessId },
      undefined,
      "ai_conversation",
    );
    await updateJob(service, job.id, { status: "organizing" });
    await replaceExtractedProcess(
      service,
      activeProcessId,
      job.organization_id,
      job.created_by,
      extracted,
      { model: OPENAI_MODELS.text },
    );
    const proposals = await createKnowledgeProposalsForProcess({
      service,
      organizationId: job.organization_id,
      userId: job.created_by,
      processId: activeProcessId,
      sourceType:
        job.client_kind === "custom_mcp" ? "external_ai" : job.client_kind,
      sourceLabel: `${sourceName} conversation`,
    });
    const summary: ExternalLearningSummary = {
      processes: extracted.steps.length ? 1 : 0,
      steps: extracted.steps.length,
      rules: extracted.rules.length,
      faqs: 0,
      clarifications: extracted.clarification_questions.length,
    };
    const completedAt = new Date().toISOString();
    await updateJob(service, job.id, {
      status: "needs_review",
      result_summary: {
        ...summary,
        suggested_questions: extracted.rules
          .slice(0, 3)
          .map((rule) => `What should I know about ${rule.title}?`),
      },
      context_text: null,
      completed_at: completedAt,
    });
    await Promise.all([
      service.from("knowledge_events").insert({
        organization_id: job.organization_id,
        event_type: "knowledge_suggested",
        actor_id: job.created_by,
        source_type: job.client_kind,
        source_id: activeProcessId,
        metadata: {
          learning_job_id: job.id,
          learning_type: job.learning_type,
          summary,
          proposal_ids: proposals.map((proposal) => proposal.id),
        },
      }),
      service.from("onboarding_events").insert([
        {
          organization_id: job.organization_id,
          user_id: job.created_by,
          event_type: "learning_processing_completed",
          metadata: { source: job.client_kind, job_id: job.id },
        },
        {
          organization_id: job.organization_id,
          user_id: job.created_by,
          event_type: "learning_completed",
          metadata: { source: job.client_kind, job_id: job.id },
        },
        {
          organization_id: job.organization_id,
          user_id: job.created_by,
          event_type: "knowledge_detected",
          metadata: { source: job.client_kind, job_id: job.id, summary },
        },
      ]),
      notifyProcessReview(service, {
        organizationId: job.organization_id,
        processId: activeProcessId,
        title: extracted.title,
        source: sourceName,
        summary,
      }),
    ]);
    const { count: previousCompleted } = await service
      .from("external_learning_jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", job.organization_id)
      .eq("created_by", job.created_by)
      .neq("id", job.id)
      .in("status", ["needs_review", "complete"]);
    if (previousCompleted === 0)
      await service.from("onboarding_events").insert({
        organization_id: job.organization_id,
        user_id: job.created_by,
        event_type: "first_external_ai_learn_completed",
        metadata: { job_id: job.id, source: job.client_kind },
      });
  } catch (error) {
    await updateJob(service, job.id, {
      status: "failed",
      error_message:
        error instanceof Error
          ? error.message.slice(0, 1000)
          : "Opryn could not organize this context.",
    });
    throw error;
  }
}

async function notifyProcessReview(
  service: SupabaseClient,
  input: {
    organizationId: string;
    processId: string;
    title: string;
    source: string;
    summary: ExternalLearningSummary;
  },
) {
  const { data: members, error: membersError } = await service
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", input.organizationId)
    .in("permission_level", ["owner", "admin"]);
  if (membersError) throw membersError;
  if (!members?.length) return;
  const targetUrl = `/app/processes/${input.processId}?review=true&returnTo=%2Fapp%2Fprocesses`;
  const { data: existing, error: existingError } = await service
    .from("notifications")
    .select("user_id")
    .eq("organization_id", input.organizationId)
    .eq("entity_type", "process")
    .eq("entity_id", input.processId)
    .eq("type", "ai_process_created");
  if (existingError) throw existingError;
  const existingUsers = new Set((existing ?? []).map((item) => item.user_id));
  const rows = members
    .filter((member) => !existingUsers.has(member.user_id))
    .map((member) => ({
      organization_id: input.organizationId,
      user_id: member.user_id,
      type: "ai_process_created",
      title: `${input.title} is ready for review`,
      body: `${input.source} created a process with ${input.summary.processes ? "structured steps" : "a process outline"}, ${input.summary.rules} rule${input.summary.rules === 1 ? "" : "s"}, and ${input.summary.clarifications} clarification${input.summary.clarifications === 1 ? "" : "s"}.`,
      link: targetUrl,
      entity_type: "process",
      entity_id: input.processId,
      action: "review",
      target_url: targetUrl,
    }));
  if (!rows.length) return;
  const { error } = await service.from("notifications").insert(rows);
  if (error) throw error;
}

export async function processPendingExternalLearningJobs(limit = 5) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("external_learning_jobs")
    .select("id")
    .in("status", ["received", "processing", "extracting", "organizing"])
    .not("context_text", "is", null)
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 10)));
  if (error) throw error;
  let processed = 0;
  for (const job of data ?? []) {
    try {
      await processExternalLearningJob(service, job.id);
      processed += 1;
    } catch (error) {
      console.error("[Opryn MCP] Pending context learning failed", {
        jobId: job.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return processed;
}

export function formatExternalLearningResponse(input: {
  job: {
    id: string;
    status: string;
    summary: ExternalLearningSummary;
    processId: string | null;
    duplicate: boolean;
  };
  name: string;
  proposals?: Awaited<ReturnType<typeof listProcessKnowledgeProposals>>;
}) {
  const reviewUrl = `https://www.opryn.app/app/processes${input.job.processId ? `/${input.job.processId}` : "?status=needs_review"}`;
  if (["needs_review", "complete"].includes(input.job.status))
    return {
      status: "learned",
      name: input.name,
      summary: input.job.summary,
      message: `${input.name} learned. Important findings are ready for owner review.`,
      proposals: input.proposals ?? [],
      approval_instruction: input.proposals?.length
        ? "Show each clear proposal with Accept and Deny. Only call an approval tool after the authenticated user explicitly chooses an action. Proposals marked review_required must be opened in Opryn."
        : undefined,
      review_url: reviewUrl,
    };
  return {
    status: "learning_started",
    name: input.name,
    job_id: input.job.id,
    message: `Opryn is learning ${input.name}. Findings will remain Observed until reviewed.`,
    review_url: reviewUrl,
  };
}

export async function listProcessKnowledgeProposals(
  service: SupabaseClient,
  organizationId: string,
  processId: string,
) {
  const { data, error } = await service
    .from("knowledge_proposals")
    .select(
      "id,title,proposed_content,status,risk_level,review_reason,source_label,related_process_id",
    )
    .eq("organization_id", organizationId)
    .eq("related_process_id", processId)
    .in("status", ["pending_approval", "needs_review"])
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((proposal) => ({
    proposal_id: proposal.id,
    title: proposal.title,
    policy: proposal.proposed_content,
    source: proposal.source_label,
    status:
      proposal.status === "needs_review"
        ? "review_required"
        : "pending_approval",
    actions:
      proposal.status === "needs_review" ? ["Review"] : ["Accept", "Deny"],
    review_reason: proposal.review_reason ?? undefined,
    review_url: proposal.related_process_id
      ? `https://www.opryn.app/app/processes/${proposal.related_process_id}?review=true&returnTo=%2Fapp%2Fneeds-you`
      : `https://www.opryn.app/app/needs-you?item=${proposal.id}`,
    instruction:
      proposal.status === "needs_review"
        ? "Do not offer one-click approval. This proposal needs review in Opryn."
        : "Only call approve_knowledge_proposal or deny_knowledge_proposal after the user explicitly says Accept/Approve or Deny/Reject.",
  }));
}

export class ExternalLearningPermissionError extends Error {
  constructor() {
    super(
      "Only an Opryn owner or admin can send conversation context into company knowledge.",
    );
    this.name = "ExternalLearningPermissionError";
  }
}

function buildExtractionContext(job: {
  learning_type: string;
  name: string;
  notes: string | null;
  context_text: string;
}) {
  return [
    `LEARNING MODE: ${job.learning_type.toUpperCase()}`,
    `FOCUS: ${job.name}`,
    job.notes ? `OWNER NOTES: ${job.notes}` : "",
    "Only extract information explicitly supported by the supplied conversation. Treat assistant messages as unverified context and route uncertainty to clarification questions.",
    "SUPPLIED CURRENT CONVERSATION:",
    job.context_text,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function preferredTitle(learningType: string, name: string) {
  if (learningType === "business") return `${name} business context`;
  return name;
}

function providerName(kind: string) {
  if (kind === "chatgpt") return "ChatGPT";
  if (kind === "claude") return "Claude";
  return "AI client";
}

function normalizeForHash(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function emptySummary(): ExternalLearningSummary {
  return { processes: 0, steps: 0, rules: 0, faqs: 0, clarifications: 0 };
}

function parseSummary(value: unknown): ExternalLearningSummary {
  if (!value || typeof value !== "object") return emptySummary();
  const summary = value as Partial<ExternalLearningSummary>;
  return {
    processes: Number(summary.processes) || 0,
    steps: Number(summary.steps) || 0,
    rules: Number(summary.rules) || 0,
    faqs: Number(summary.faqs) || 0,
    clarifications: Number(summary.clarifications) || 0,
  };
}

async function updateJob(
  service: SupabaseClient,
  jobId: string,
  values: Record<string, unknown>,
) {
  const { error } = await service
    .from("external_learning_jobs")
    .update(values)
    .eq("id", jobId);
  if (error) throw error;
}
