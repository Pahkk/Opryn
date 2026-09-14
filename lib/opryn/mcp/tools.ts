import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import { answerCompanyQuestion } from "@/lib/ai/services";
import { searchCompanyKnowledge } from "@/lib/opryn/knowledge/retrieval";
import { resolveKnowledgeSources } from "@/lib/opryn/knowledge/sources";
import { requireMcpScope, type McpAuthContext } from "@/lib/opryn/oauth/tokens";
import {
  askOprynFromMcp,
  logMcpActivity,
  requestGuidanceFromMcp,
} from "@/lib/opryn/mcp/service";
import {
  createProcessFromContext,
  formatExternalLearningResponse,
  listProcessKnowledgeProposals,
  processExternalLearningJob,
  startExternalLearning,
} from "@/lib/opryn/mcp/learning";
import {
  approveProcessKnowledge,
  assessProcessApprovalRisk,
  rejectProcessKnowledge,
} from "@/lib/opryn/processes/approval";
import {
  approveKnowledgeProposal,
  ProposalResolutionError,
  rejectKnowledgeProposal,
} from "@/lib/opryn/knowledge/proposals";

const questionSchema = z.object({
  question: z.string().trim().min(3).max(4000),
  context: z.string().trim().max(4000).optional(),
});

const searchSchema = z.object({
  query: z.string().trim().min(2).max(2000),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

const policySchema = z.object({ topic: z.string().trim().min(2).max(500) });
const processSchema = z.object({ query: z.string().trim().min(2).max(500) });
const learningSchema = z.object({
  name: z.string().trim().min(1).max(200),
  learning_type: z.enum(["business", "process", "topic"]),
  focus: z.string().trim().max(200).optional(),
  context: z.string().trim().min(40).max(100000),
  notes: z.string().trim().max(3000).optional(),
  source_title: z.string().trim().max(300).optional(),
});
const createProcessSchema = z.object({
  title: z.string().trim().min(1).max(200),
  context: z.string().trim().min(40).max(100000),
  description: z.string().trim().max(3000).optional(),
  source_title: z.string().trim().max(300).optional(),
});
const writeProcessSchema = z.object({
  title: z.string().trim().min(1).max(200),
  purpose: z.string().trim().min(1).max(5000),
  steps: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(10000).optional().default(""),
      }),
    )
    .min(1)
    .max(100),
  rules: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        text: z.string().trim().min(1).max(10000),
      }),
    )
    .max(100)
    .optional()
    .default([]),
  exceptions: z
    .array(z.string().trim().min(1).max(10000))
    .max(100)
    .optional()
    .default([]),
  responsibilities: z
    .array(z.string().trim().min(1).max(2000))
    .max(50)
    .optional()
    .default([]),
  clarification_questions: z
    .array(z.string().trim().min(1).max(2000))
    .max(20)
    .optional()
    .default([]),
  source_title: z.string().trim().max(300).optional(),
});
const approveProcessSchema = z.object({
  process_id: z.string().uuid(),
});
const approveProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  version: z
    .number()
    .int()
    .positive()
    .describe("Exact proposal version presented to the user."),
  updated_at: z
    .string()
    .min(10)
    .max(64)
    .describe("updatedAt from the proposal the user reviewed."),
});
const denyProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  version: z
    .number()
    .int()
    .positive()
    .describe("Exact proposal version presented to the user."),
  updated_at: z
    .string()
    .min(10)
    .max(64)
    .describe("updatedAt from the proposal the user reviewed."),
  reason: z.string().trim().max(1000).optional(),
});

export function registerOprynTools(
  server: McpServer,
  service: SupabaseClient,
  auth: McpAuthContext,
) {
  server.registerTool(
    "create_process",
    {
      title: "Write a process to Opryn",
      description:
        "WRITE ACTION: Create a structured company process in Opryn when the authenticated human explicitly asks to add or save that exact process. Supply its purpose and ordered steps, plus any supported rules, exceptions, responsibilities, or missing details. Opryn saves it as Needs Review with source traceability and never silently makes it official. Do not call this tool merely because a process could be useful, and do not call it without a clear human request.",
      inputSchema: writeProcessSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({
      title,
      purpose,
      steps,
      rules,
      exceptions,
      responsibilities,
      clarification_questions,
      source_title,
    }) =>
      runTool(
        service,
        auth,
        // Reuse the established audited process-write activity category so
        // existing deployments and grants can expose this clearer tool name
        // without introducing a second persistence path.
        "create_process_from_context",
        async () => {
          requireMcpScope(auth, "opryn.processes.create");
          if (!["owner", "admin"].includes(auth.permissionLevel))
            throw new Error(
              "Only an Opryn owner or admin can create a company process.",
            );
          const created = await createProcessFromContext(service, auth, {
            name: title,
            context: formatStructuredProcessContext({
              title,
              purpose,
              steps,
              rules,
              exceptions,
              responsibilities,
              clarificationQuestions: clarification_questions,
            }),
            notes:
              "The authenticated user explicitly asked Opryn to write this structured process. Preserve the supplied ordering and do not invent missing company policy.",
            sourceTitle: source_title,
          });
          const result = {
            status: created.status,
            process_id: created.processId,
            title,
            steps_found: created.summary.steps,
            rules_found: created.summary.rules,
            clarifications: created.summary.clarifications,
            policy_proposals: created.proposals,
            message: `${title} was written to Opryn as Needs Review.`,
            actions: ["Approve Now", "Review", "Deny", "Later"],
            review_url: created.reviewUrl,
            instruction:
              "Present the result to the user. Call approve_process or deny_process only after the user explicitly chooses that action.",
          };
          return { result, status: created.status, sourceCount: 0 };
        },
        { requiresPremium: false, minuteLimit: 4, hourLimit: 20 },
      ),
  );

  server.registerTool(
    "create_process_from_context",
    {
      title: "Create a suggested company process",
      description:
        "Create a structured Opryn process from business-specific information in the CURRENT conversation. Use only when the user explicitly asks Opryn to create a process. Extract ordered steps, rules, exceptions, responsibilities, and missing details from supplied context. The process is saved once as Needs Review with source traceability; it is never silently made official. After creation, present Approve Now, Review First, and Later. Use approve_process only after the user explicitly chooses Approve Now.",
      inputSchema: createProcessSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ title, context, description, source_title }) =>
      runTool(
        service,
        auth,
        "create_process_from_context",
        async () => {
          // Existing ChatGPT/Claude grants already consented to sending
          // selected conversation context for owner review. Keep process
          // drafting compatible with those grants; direct approval always
          // requires the newer, explicit approval scope below.
          if (
            !auth.scopes.has("opryn.processes.create") &&
            !auth.scopes.has("opryn.learning.create")
          )
            requireMcpScope(auth, "opryn.processes.create");
          const created = await createProcessFromContext(service, auth, {
            name: title,
            context,
            notes: description,
            sourceTitle: source_title,
          });
          const { data: preferences } = await service
            .from("organization_settings")
            .select("ai_process_approval_prompt")
            .eq("organization_id", auth.organizationId)
            .maybeSingle();
          const approvalOptions =
            preferences?.ai_process_approval_prompt === "add_to_needs_approval"
              ? ["Review First", "Deny", "Later"]
              : ["Approve Now", "Review First", "Deny", "Later"];
          const result = {
            status: created.status,
            process_id: created.processId,
            title,
            steps_found: created.summary.steps,
            rules_found: created.summary.rules,
            clarifications: created.summary.clarifications,
            policy_proposals: created.proposals,
            message: `${title} created. It is saved in Opryn and ready for review.`,
            approval_options: approvalOptions,
            review_url: created.reviewUrl,
            instruction:
              "If buttons are unavailable, ask whether the user wants to approve now or review it in Opryn. Do not approve without an explicit choice.",
          };
          return { result, status: created.status, sourceCount: 0 };
        },
        { requiresPremium: false, minuteLimit: 4, hourLimit: 20 },
      ),
  );

  server.registerTool(
    "approve_knowledge_proposal",
    {
      title: "Accept an Opryn policy proposal",
      description:
        "Approve one pending Opryn knowledge proposal. Call this write tool ONLY after the authenticated human explicitly says Accept or Approve for that exact proposal. Never infer approval from context, silence, prior preferences, or the model's own judgment. Proposals with unresolved high-risk ambiguity return review_required instead of being approved.",
      inputSchema: approveProposalSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ proposal_id, version, updated_at }) =>
      runTool(
        service,
        auth,
        "approve_knowledge_proposal",
        async () => {
          requireMcpScope(auth, "opryn.processes.approve");
          if (!["owner", "admin"].includes(auth.permissionLevel))
            throw new Error("Owner or admin approval is required.");
          try {
            const approved = await approveKnowledgeProposal({
              service,
              organizationId: auth.organizationId,
              userId: auth.userId,
              proposalId: proposal_id,
              expectedVersion: version,
              expectedUpdatedAt: updated_at,
              approvalSource:
                auth.clientKind === "custom_mcp"
                  ? "external_ai"
                  : auth.clientKind,
            });
            return {
              result: {
                status: "approved",
                title: approved.title,
                policy: approved.content,
                message:
                  "Added to Opryn. Your team and connected AI tools can use this now.",
              },
              status: "approved",
              sourceCount: 0,
            };
          } catch (error) {
            if (
              error instanceof ProposalResolutionError &&
              error.code === "review_required"
            )
              return {
                result: {
                  status: "review_required",
                  message: error.message,
                  review_url: `https://www.opryn.app/app/needs-you?item=${proposal_id}`,
                },
                status: "review_required",
                sourceCount: 0,
              };
            throw error;
          }
        },
        { requiresPremium: false, minuteLimit: 8, hourLimit: 40 },
      ),
  );

  server.registerTool(
    "deny_knowledge_proposal",
    {
      title: "Deny an Opryn policy proposal",
      description:
        "Reject one pending Opryn knowledge proposal. Call this write tool ONLY after the authenticated human explicitly says Deny or Reject for that exact proposal. Never decide to reject a proposal on the user's behalf. A reason is optional.",
      inputSchema: denyProposalSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ proposal_id, reason, version, updated_at }) =>
      runTool(
        service,
        auth,
        "deny_knowledge_proposal",
        async () => {
          requireMcpScope(auth, "opryn.processes.approve");
          if (!["owner", "admin"].includes(auth.permissionLevel))
            throw new Error("Owner or admin approval is required.");
          const rejected = await rejectKnowledgeProposal({
            service,
            organizationId: auth.organizationId,
            userId: auth.userId,
            proposalId: proposal_id,
            expectedVersion: version,
            expectedUpdatedAt: updated_at,
            reason,
            rejectionSource:
              auth.clientKind === "custom_mcp"
                ? "external_ai"
                : auth.clientKind,
          });
          return {
            result: {
              status: "rejected",
              title: rejected.title,
              message: "Not added. Opryn won't use this as company policy.",
            },
            status: "rejected",
            sourceCount: 0,
          };
        },
        { requiresPremium: false, minuteLimit: 8, hourLimit: 40 },
      ),
  );

  server.registerTool(
    "answer_only_knowledge_proposal",
    {
      title: "Use guidance once without making policy",
      description:
        "Resolve a pending policy proposal as Answer Only so the guidance is not added to official company knowledge. Call ONLY after the authenticated human explicitly says this is a one-time answer or chooses Answer Only for that exact proposal.",
      inputSchema: denyProposalSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ proposal_id, reason, version, updated_at }) =>
      runTool(
        service,
        auth,
        "answer_only_knowledge_proposal",
        async () => {
          requireMcpScope(auth, "opryn.processes.approve");
          if (!["owner", "admin"].includes(auth.permissionLevel))
            throw new Error("Owner or admin approval is required.");
          const resolved = await rejectKnowledgeProposal({
            service,
            organizationId: auth.organizationId,
            userId: auth.userId,
            proposalId: proposal_id,
            expectedVersion: version,
            expectedUpdatedAt: updated_at,
            reason: reason || "One-time answer",
            answerOnly: true,
            rejectionSource:
              auth.clientKind === "custom_mcp"
                ? "external_ai"
                : auth.clientKind,
          });
          return {
            result: {
              status: "answer_only",
              title: resolved.title,
              message:
                "Answer kept as a one-time response. Opryn did not add it as company policy.",
            },
            status: "answer_only",
            sourceCount: 0,
          };
        },
        { requiresPremium: false, minuteLimit: 8, hourLimit: 40 },
      ),
  );

  server.registerTool(
    "approve_process",
    {
      title: "Approve a suggested Opryn process",
      description:
        "Approve a process previously created in Opryn, only after the authenticated owner/admin explicitly chooses Approve Now. High-risk processes and processes with unresolved clarification questions must be reviewed in Opryn instead.",
      inputSchema: approveProcessSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ process_id }) =>
      runTool(service, auth, "approve_process", async () => {
        requireMcpScope(auth, "opryn.processes.approve");
        if (!["owner", "admin"].includes(auth.permissionLevel))
          throw new Error("Owner or admin approval is required.");
        const risk = await assessProcessApprovalRisk(
          service,
          auth.organizationId,
          process_id,
        );
        const reviewUrl = `https://www.opryn.app/app/processes/${process_id}?review=true&returnTo=%2Fapp%2Fprocesses`;
        if (risk.critical || risk.unresolvedClarifications) {
          const result = {
            status: "review_required",
            message:
              "This process needs an individual review before it can become official.",
            reasons: risk.reasons,
            review_url: reviewUrl,
          };
          return { result, status: "review_required", sourceCount: 0 };
        }
        const approved = await approveProcessKnowledge({
          service,
          organizationId: auth.organizationId,
          userId: auth.userId,
          processId: process_id,
        });
        const result = {
          status: "approved",
          title: approved.title,
          message:
            "Process approved. Your team and connected AI tools can use it now.",
          process_url: `https://www.opryn.app/app/processes/${process_id}`,
        };
        return { result, status: "approved", sourceCount: 0 };
      }),
  );

  server.registerTool(
    "deny_process",
    {
      title: "Deny a suggested Opryn process",
      description:
        "Reject a Needs Review process created from conversation context. Call only after the authenticated owner/admin explicitly chooses Deny or Reject for that exact process. Never reject an approved process or decide on the user's behalf.",
      inputSchema: approveProcessSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
      },
    },
    async ({ process_id }) =>
      runTool(
        service,
        auth,
        "deny_process",
        async () => {
          requireMcpScope(auth, "opryn.processes.approve");
          if (!["owner", "admin"].includes(auth.permissionLevel))
            throw new Error("Owner or admin approval is required.");
          const result = await rejectProcessKnowledge({
            service,
            organizationId: auth.organizationId,
            userId: auth.userId,
            processId: process_id,
            source:
              auth.clientKind === "custom_mcp"
                ? "external_ai"
                : auth.clientKind,
          });
          return {
            result: {
              status: "rejected",
              title: result.title,
              message: "Not added. Opryn won't use this as a company process.",
            },
            status: "rejected",
            sourceCount: 0,
          };
        },
        { requiresPremium: false, minuteLimit: 8, hourLimit: 40 },
      ),
  );

  server.registerTool(
    "learn_from_context",
    {
      title: "Learn from this conversation",
      description:
        "Send business-specific information from the CURRENT conversation to Opryn for owner review. Use only when the user explicitly asks Opryn to learn, remember, or be taught from the current conversation or supplied context. Supported modes are business, process, and topic. Include only relevant context actually available in this conversation; never assume access to other chats or account history. Findings remain Observed and are not approved company policy until reviewed in Opryn.",
      inputSchema: learningSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, learning_type, focus, context, notes, source_title }) =>
      runTool(
        service,
        auth,
        "learn_from_context",
        async () => {
          requireMcpScope(auth, "opryn.learning.create");
          const job = await startExternalLearning(service, auth, {
            name: learning_type === "business" ? name : focus || name,
            learningType: learning_type,
            context,
            notes,
            sourceTitle: source_title,
          });
          if (!["needs_review", "complete"].includes(job.status))
            await processExternalLearningJob(service, job.id);
          const { data: completedJob, error: completedJobError } = await service
            .from("external_learning_jobs")
            .select("id,status,result_summary,process_id")
            .eq("id", job.id)
            .eq("organization_id", auth.organizationId)
            .single();
          if (completedJobError) throw completedJobError;
          const liveJob = {
            id: completedJob.id,
            status: completedJob.status,
            summary: parseLearningSummary(completedJob.result_summary),
            processId: completedJob.process_id as string | null,
            duplicate: job.duplicate,
          };
          const proposals = liveJob.processId
            ? await listProcessKnowledgeProposals(
                service,
                auth.organizationId,
                liveJob.processId,
              )
            : [];
          const result = formatExternalLearningResponse({
            job: liveJob,
            name,
            proposals,
          });
          return {
            result,
            status: result.status,
            sourceCount: 0,
          };
        },
        { requiresPremium: false, minuteLimit: 5, hourLimit: 25 },
      ),
  );

  server.registerTool(
    "ask_opryn",
    {
      title: "Ask Opryn",
      description:
        "Ask about the authenticated business's processes, rules, policies, FAQs, role knowledge, or approved owner guidance. Use for company-specific questions, never generic world knowledge. If status is unknown, do not invent an answer; offer request_owner_guidance.",
      inputSchema: questionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ question, context }) =>
      runTool(service, auth, "ask_opryn", async () => {
        requireMcpScope(auth, "opryn.knowledge.read");
        const result = await askOprynFromMcp(service, auth, question, context);
        return {
          result,
          status: result.status,
          sourceCount: result.status === "answered" ? result.sources.length : 0,
        };
      }),
  );

  server.registerTool(
    "search_company_knowledge",
    {
      title: "Search company knowledge",
      description:
        "Search the authenticated user's permitted, Approved Opryn company knowledge. Use when several company sources may be relevant. Draft, Observed, rejected, conflicted, and unauthorized knowledge is never returned.",
      inputSchema: searchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) =>
      runTool(service, auth, "search_company_knowledge", async () => {
        requireMcpScope(auth, "opryn.knowledge.read");
        const { knowledge } = await searchCompanyKnowledge({
          service,
          organizationId: auth.organizationId,
          userId: auth.userId,
          query,
          limit,
        });
        const sources = auth.scopes.has("opryn.sources.read")
          ? await resolveKnowledgeSources(service, knowledge)
          : [];
        const sourceMap = new Map(
          sources.map((source) => [source.knowledge_id, source]),
        );
        const result = {
          results: knowledge.map((item) => ({
            id: item.id,
            type: item.source_type,
            title:
              sourceMap.get(item.id)?.title ||
              item.content.split(/[.:]/)[0].slice(0, 120),
            content: item.content,
            source: sourceMap.get(item.id) ?? undefined,
          })),
        };
        return {
          result,
          status: knowledge.length ? "answered" : "not_found",
          sourceCount: knowledge.length,
        };
      }),
  );

  server.registerTool(
    "check_company_policy",
    {
      title: "Check company policy",
      description:
        "Check for an Approved company policy on a specific topic such as refunds, discounts, pricing, scheduling, or approval limits. Never use a plausible generic policy when Opryn returns unknown.",
      inputSchema: policySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ topic }) =>
      runTool(service, auth, "check_company_policy", async () => {
        requireMcpScope(auth, "opryn.knowledge.read");
        const { knowledge } = await searchCompanyKnowledge({
          service,
          organizationId: auth.organizationId,
          userId: auth.userId,
          query: `company policy for ${topic}`,
          limit: 12,
        });
        const policyKnowledge = knowledge.filter((item) =>
          ["rule", "owner_answer", "exception", "faq"].includes(
            item.source_type,
          ),
        );
        const answer = policyKnowledge.length
          ? await answerCompanyQuestion(
              `What is the approved company policy for ${topic}?`,
              policyKnowledge,
            )
          : null;
        const cited = answer?.can_answer
          ? policyKnowledge.filter((item) =>
              answer.cited_source_ids.includes(item.id),
            )
          : [];
        const criticalPolicy = cited.length
          ? await hasCriticalKnowledge(
              service,
              auth.organizationId,
              cited.map((item) => item.id),
            )
          : false;
        if (
          !answer?.can_answer ||
          answer.confidence < (criticalPolicy ? 0.9 : 0.76) ||
          !answer.answer.trim() ||
          !cited.length
        ) {
          const result = {
            status: "unknown",
            policy: null,
            can_escalate: auth.scopes.has("opryn.escalations.create"),
          };
          return { result, status: "unknown", sourceCount: 0 };
        }
        const result = {
          status: "found",
          policy: [answer.answer, ...answer.steps, answer.important_note]
            .filter(Boolean)
            .join("\n"),
          requires_approval: answer.requires_approval,
          approval_reason: answer.approval_reason || undefined,
          sources: auth.scopes.has("opryn.sources.read")
            ? await resolveKnowledgeSources(service, cited)
            : [],
        };
        return { result, status: "answered", sourceCount: cited.length };
      }),
  );

  server.registerTool(
    "get_company_process",
    {
      title: "Get company process",
      description:
        "Retrieve an Approved process the authenticated user is permitted to see, including its practical steps and approved rules. Use for company-specific how-to questions.",
      inputSchema: processSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ query }) =>
      runTool(service, auth, "get_company_process", async () => {
        requireMcpScope(auth, "opryn.processes.read");
        const { knowledge } = await searchCompanyKnowledge({
          service,
          organizationId: auth.organizationId,
          userId: auth.userId,
          query,
          limit: 20,
        });
        const candidate = knowledge.find((item) => item.process_id);
        if (!candidate?.process_id)
          return {
            result: { status: "not_found", process: null },
            status: "not_found",
            sourceCount: 0,
          };
        if (!(await canReadProcess(service, auth, candidate.process_id)))
          return {
            result: { status: "not_found", process: null },
            status: "not_found",
            sourceCount: 0,
          };
        const [{ data: process }, { data: steps }, { data: rules }] =
          await Promise.all([
            service
              .from("processes")
              .select("id,title,summary,purpose")
              .eq("id", candidate.process_id)
              .eq("organization_id", auth.organizationId)
              .eq("status", "approved")
              .maybeSingle(),
            service
              .from("process_steps")
              .select("step_order,title,description")
              .eq("process_id", candidate.process_id)
              .eq("organization_id", auth.organizationId)
              .order("step_order"),
            service
              .from("process_rules")
              .select("id,title,text")
              .eq("process_id", candidate.process_id)
              .eq("organization_id", auth.organizationId)
              .eq("status", "approved"),
          ]);
        if (!process)
          return {
            result: { status: "not_found", process: null },
            status: "not_found",
            sourceCount: 0,
          };
        const sources = auth.scopes.has("opryn.sources.read")
          ? await resolveKnowledgeSources(service, [candidate])
          : [];
        const result = {
          status: "found",
          title: process.title,
          summary: process.summary,
          purpose: process.purpose,
          steps: (steps ?? []).map((step) => ({
            order: step.step_order,
            title: step.title,
            description: step.description,
          })),
          rules: rules ?? [],
          sources,
        };
        return { result, status: "answered", sourceCount: sources.length };
      }),
  );

  server.registerTool(
    "request_owner_guidance",
    {
      title: "Request owner or expert guidance",
      description:
        "Create an Opryn guidance request when Approved company knowledge is insufficient. Routes the question to the best configured company expert or an owner. This never approves or edits company knowledge.",
      inputSchema: questionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ question, context }) =>
      runTool(service, auth, "request_owner_guidance", async () => {
        requireMcpScope(auth, "opryn.escalations.create");
        const result = await requestGuidanceFromMcp(
          service,
          auth,
          question,
          context,
        );
        return { result, status: "submitted", sourceCount: 0 };
      }),
  );
}

function parseLearningSummary(value: unknown) {
  if (!value || typeof value !== "object")
    return { processes: 0, steps: 0, rules: 0, faqs: 0, clarifications: 0 };
  const summary = value as Record<string, unknown>;
  return {
    processes: Number(summary.processes) || 0,
    steps: Number(summary.steps) || 0,
    rules: Number(summary.rules) || 0,
    faqs: Number(summary.faqs) || 0,
    clarifications: Number(summary.clarifications) || 0,
  };
}

async function runTool(
  service: SupabaseClient,
  auth: McpAuthContext,
  toolName: string,
  execute: () => Promise<{
    result: unknown;
    status: string;
    sourceCount: number;
  }>,
  options: {
    requiresPremium?: boolean;
    minuteLimit?: number;
    hourLimit?: number;
  } = {},
) {
  const startedAt = Date.now();
  try {
    const requiresPremium = options.requiresPremium ?? true;
    const subscription = requiresPremium
      ? await getOrganizationPlan(service, auth.organizationId)
      : null;
    if (subscription && !hasFeature(subscription.plan, "mcpAccess")) {
      await logMcpActivity(service, auth, {
        toolName,
        resultStatus: "premium_required",
        startedAt,
      });
      return toolResult(
        {
          error: "premium_required",
          message:
            "Opryn is connected. Finish onboarding, then activate Opryn Everywhere to use approved company knowledge here.",
          upgrade_url: "https://www.opryn.app/pricing",
        },
        true,
      );
    }
    const { data: allowed } = await service.rpc("consume_mcp_rate_limit", {
      target_grant_id: auth.grantId,
      minute_limit: options.minuteLimit ?? 30,
      hour_limit: options.hourLimit ?? 500,
    });
    if (!allowed) {
      await logMcpActivity(service, auth, {
        toolName,
        resultStatus: "rate_limited",
        startedAt,
      });
      return toolResult(
        {
          error: "rate_limited",
          message: "Opryn received too many requests. Try again shortly.",
        },
        true,
      );
    }
    const output = await execute();
    await logMcpActivity(service, auth, {
      toolName,
      resultStatus: output.status,
      sourceCount: output.sourceCount,
      startedAt,
    });
    return toolResult(output.result);
  } catch (error) {
    const forbidden =
      error instanceof Error &&
      ["McpInsufficientScopeError", "ExternalLearningPermissionError"].includes(
        error.name,
      );
    await logMcpActivity(service, auth, {
      toolName,
      resultStatus: forbidden ? "forbidden" : "error",
      startedAt,
    }).catch(() => undefined);
    console.error("[Opryn MCP] Tool failed", {
      tool: toolName,
      organizationId: auth.organizationId,
      grantId: auth.grantId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return toolResult(
      {
        error: forbidden ? "insufficient_scope" : "tool_failed",
        message:
          forbidden && error instanceof Error
            ? error.message
            : "Opryn could not complete this request.",
      },
      true,
    );
  }
}

function toolResult(result: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
    structuredContent: result as Record<string, unknown>,
    isError,
  };
}

function formatStructuredProcessContext(input: {
  title: string;
  purpose: string;
  steps: Array<{ title: string; description: string }>;
  rules: Array<{ title: string; text: string }>;
  exceptions: string[];
  responsibilities: string[];
  clarificationQuestions: string[];
}) {
  const sections = [
    `PROCESS: ${input.title}`,
    `PURPOSE:\n${input.purpose}`,
    `ORDERED STEPS:\n${input.steps
      .map(
        (step, index) =>
          `${index + 1}. ${step.title}${step.description ? ` — ${step.description}` : ""}`,
      )
      .join("\n")}`,
  ];
  if (input.rules.length)
    sections.push(
      `COMPANY RULES:\n${input.rules
        .map((rule) => `- ${rule.title}: ${rule.text}`)
        .join("\n")}`,
    );
  if (input.exceptions.length)
    sections.push(
      `EXCEPTIONS:\n${input.exceptions.map((item) => `- ${item}`).join("\n")}`,
    );
  if (input.responsibilities.length)
    sections.push(
      `RESPONSIBILITIES:\n${input.responsibilities
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  if (input.clarificationQuestions.length)
    sections.push(
      `UNRESOLVED QUESTIONS:\n${input.clarificationQuestions
        .map((item) => `- ${item}`)
        .join("\n")}`,
    );
  return sections.join("\n\n");
}

async function hasCriticalKnowledge(
  service: SupabaseClient,
  organizationId: string,
  knowledgeIds: string[],
) {
  const { count, error } = await service
    .from("knowledge_chunks")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("approved", true)
    .eq("criticality", "critical")
    .in("id", knowledgeIds);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function canReadProcess(
  service: SupabaseClient,
  auth: McpAuthContext,
  processId: string,
) {
  if (auth.permissionLevel === "owner" || auth.permissionLevel === "admin")
    return true;
  const { data } = await service
    .from("process_role_assignments")
    .select("role_id")
    .eq("organization_id", auth.organizationId)
    .eq("process_id", processId);
  if (!data?.length) return true;
  return Boolean(
    auth.roleId && data.some((row) => row.role_id === auth.roleId),
  );
}
