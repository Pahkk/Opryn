import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { findCompanyExpert } from "@/lib/opryn/knowledge/experts";
import { z } from "zod";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
import { memberScopeContext } from "@/lib/opryn/knowledge/scope-context";
import { apiError, getRequestContext } from "@/lib/api";
import {
  answerCompanyQuestion,
  analyzeEmployeeQuestionImage,
  embedKnowledge,
  type EmployeeQuestionImage,
  type RetrievedKnowledge,
} from "@/lib/ai/services";

const allowedImageTypes = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const imageSchema = z.object({
  dataUrl: z.string().max(3_600_000),
  mimeType: allowedImageTypes,
  name: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(2_621_440),
});
const schema = z.object({
  question: z.string().trim().min(3).max(4000),
  scopeContext: scopeContextSchema.optional(),
  image: imageSchema.nullable().optional(),
  conversationId: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "opryn"]),
        text: z.string().trim().min(1).max(1200),
      }),
    )
    .max(6)
    .default([]),
});
export async function POST(request: Request) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Ask a complete question and attach a JPG, PNG, WEBP, or GIF under 2.5 MB.",
      },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const { data: settings, error: settingsError } = await supabase
    .from("organization_settings")
    .select("employees_can_ask, allow_escalations, confidence_threshold")
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (settingsError)
    return apiError(
      settingsError,
      "Your workspace permissions could not be checked. Please retry.",
    );
  if (settings && !settings.employees_can_ask)
    return NextResponse.json(
      { error: "Ask Opryn is disabled for this workspace." },
      { status: 403 },
    );
  try {
    const image = parsed.data.image
      ? decodeImage(parsed.data.image)
      : undefined;
    const imageCase = image
      ? await analyzeEmployeeQuestionImage(parsed.data.question, image)
      : null;
    const recentUserContext = parsed.data.history
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.text)
      .join("\n");
    const retrievalQuery = [
      recentUserContext,
      parsed.data.question,
      imageCase?.knowledge_search_query,
      imageCase?.visible_text,
    ]
      .filter(Boolean)
      .join("\n");
    const [embedding] = await embedKnowledge([retrievalQuery]);
    const { data, error: searchError } = await supabase.rpc("match_knowledge", {
      target_organization_id: membership.organization_id,
      query_embedding: embedding,
      target_role_id: membership.role_id,
      // Vector similarity only decides which approved sources the model reads.
      // Answer confidence is evaluated separately below.
      match_threshold: 0.3,
      match_count: 15,
    });
    if (searchError) throw searchError;
    const knowledge = await trustedAnswerContext(
      supabase,
      membership.organization_id,
      (data ?? []) as RetrievedKnowledge[],
      await memberScopeContext(
        supabase,
        membership.organization_id,
        user.id,
        "employee",
        parsed.data.scopeContext,
      ),
    );
    const { data: criticalRows } = knowledge.length
      ? await supabase
          .from("knowledge_chunks")
          .select("id")
          .eq("organization_id", membership.organization_id)
          .eq("criticality", "critical")
          .in(
            "id",
            knowledge.map((item) => item.id),
          )
      : { data: [] };
    const criticalMatch = Boolean(criticalRows?.length);
    const answer = knowledge.length
      ? await answerCompanyQuestion(
          parsed.data.question,
          knowledge,
          image && imageCase
            ? {
                ...image,
                description: imageCase.description,
                visibleText: imageCase.visible_text,
              }
            : undefined,
          parsed.data.history,
        )
      : {
          can_answer: false,
          confidence: 0,
          headline: "",
          answer: "",
          steps: [],
          important_note: "",
          requires_approval: false,
          approval_reason: "",
          cited_source_ids: [],
        };
    const answerThreshold = criticalMatch
      ? Math.max(settings?.confidence_threshold ?? 0.72, 0.9)
      : (settings?.confidence_threshold ?? 0.72);
    if (
      !answer.can_answer ||
      answer.confidence < answerThreshold ||
      !answer.answer.trim() ||
      !knowledge.some((item) => answer.cited_source_ids.includes(item.id))
    ) {
      const { data: clusterId, error: clusterError } = await supabase.rpc(
        "record_question_cluster",
        {
          target_organization_id: membership.organization_id,
          question_text: parsed.data.question,
          question_embedding: embedding,
          question_origin: "employee",
        },
      );
      if (clusterError) throw clusterError;
      const expert = await findBestExpert({
        supabase,
        organizationId: membership.organization_id,
        question: parsed.data.question,
        closestKnowledgeId: knowledge[0]?.id,
      });
      const { data: question, error } = await supabase
        .from("employee_questions")
        .insert({
          organization_id: membership.organization_id,
          asked_by: user.id,
          question: parsed.data.question,
          status: "needs_owner",
          answered_by_opryn: false,
          escalated: settings?.allow_escalations ?? true,
          relevance_score: knowledge[0]?.similarity ?? null,
          cluster_id: clusterId,
          assigned_expert_id: expert?.id ?? null,
          assigned_expert_rule_id: expert?.assignmentId ?? null,
          conversation_id: parsed.data.conversationId ?? null,
          conversation_context: parsed.data.history,
          scope_context: parsed.data.scopeContext ?? {},
          origin: "employee",
        })
        .select("id")
        .single();
      if (error) throw error;
      await saveQuestionImage({
        supabase,
        organizationId: membership.organization_id,
        userId: user.id,
        questionId: question.id,
        image,
        originalName: parsed.data.image?.name,
      });
      await recordEvents(supabase, [
        {
          organization_id: membership.organization_id,
          event_type: "question_asked",
          actor_id: user.id,
          question_id: question.id,
          metadata: { origin: "employee" },
        },
        {
          organization_id: membership.organization_id,
          event_type: "question_unknown",
          actor_id: user.id,
          question_id: question.id,
          metadata: { has_related_knowledge: Boolean(knowledge[0]) },
        },
        {
          organization_id: membership.organization_id,
          event_type: "question_clustered",
          actor_id: user.id,
          question_id: question.id,
          source_id: clusterId,
          metadata: {},
        },
      ]);
      const closestSources = knowledge[0]
        ? await buildSourceCards(supabase, [knowledge[0]])
        : [];
      return NextResponse.json({
        type: "unknown",
        questionId: question.id,
        canEscalate: settings?.allow_escalations ?? true,
        routed: settings?.allow_escalations ?? true,
        imageAttached: Boolean(image),
        expert: expert ? { id: expert.id, name: expert.name } : null,
        critical: criticalMatch,
        closest: knowledge[0]
          ? {
              content: knowledge[0].content,
              processId: knowledge[0].process_id,
              source: closestSources[0] ?? null,
            }
          : null,
      });
    }
    const cited = knowledge.filter((item) =>
      answer.cited_source_ids.includes(item.id),
    );
    if (!cited.length)
      throw new Error("The answer did not cite approved knowledge.");
    const { data: question, error: questionError } = await supabase
      .from("employee_questions")
      .insert({
        organization_id: membership.organization_id,
        asked_by: user.id,
        question: parsed.data.question,
        status: "answered",
        scope_context: parsed.data.scopeContext ?? {},
        answered_by_opryn: true,
        escalated: false,
        related_process_id: cited[0].process_id,
        relevance_score: cited[0].similarity,
        conversation_id: parsed.data.conversationId ?? null,
        conversation_context: parsed.data.history,
        origin: "employee",
      })
      .select("id")
      .single();
    if (questionError) throw questionError;
    await saveQuestionImage({
      supabase,
      organizationId: membership.organization_id,
      userId: user.id,
      questionId: question.id,
      image,
      originalName: parsed.data.image?.name,
    });
    const { error: answerError } = await supabase
      .from("question_answers")
      .insert({
        organization_id: membership.organization_id,
        question_id: question.id,
        answer: [
          answer.answer,
          answer.steps.length
            ? answer.steps
                .map((step, index) => `${index + 1}. ${step}`)
                .join("\n")
            : "",
          answer.important_note,
        ]
          .filter(Boolean)
          .join("\n\n"),
        answered_by: null,
        answer_type: "opryn",
      });
    if (answerError) throw answerError;
    const { error: sourcesError } = await supabase
      .from("question_sources")
      .insert(
        cited.map((item) => ({
          organization_id: membership.organization_id,
          question_id: question.id,
          knowledge_chunk_id: item.id,
          similarity: item.similarity,
        })),
      );
    if (sourcesError) throw sourcesError;
    await supabase.rpc("record_knowledge_usage", {
      target_organization_id: membership.organization_id,
      target_chunk_ids: cited.map((item) => item.id),
      usage_origin: "employee",
    });
    await recordEvents(supabase, [
      {
        organization_id: membership.organization_id,
        event_type: "question_asked",
        actor_id: user.id,
        question_id: question.id,
        metadata: { origin: "employee" },
      },
      {
        organization_id: membership.organization_id,
        event_type: "question_answered",
        actor_id: user.id,
        question_id: question.id,
        knowledge_chunk_id: cited[0].id,
        metadata: { source_count: cited.length },
      },
    ]);
    const sourceCards = await buildSourceCards(supabase, cited);
    // Activation is recorded from a real persisted, cited answer, not a browser flag.
    const activation = await supabase.rpc("record_activation_answer", {
      workspace_id: membership.organization_id,
      question_id: question.id,
    });
    if (activation.error)
      console.error(
        "[Opryn setup] Answer saved; activation progress needs retry",
      );
    return NextResponse.json({
      type: "answer",
      questionId: question.id,
      headline: answer.headline,
      answer: answer.answer,
      steps: answer.steps,
      importantNote: answer.important_note,
      requiresApproval: answer.requires_approval,
      approvalReason: answer.approval_reason,
      imageAttached: Boolean(image),
      sources: sourceCards,
    });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't search your company knowledge right now. Please try again.",
    );
  }
}

function decodeImage(
  input: z.infer<typeof imageSchema>,
): EmployeeQuestionImage {
  const prefix = `data:${input.mimeType};base64,`;
  if (!input.dataUrl.startsWith(prefix))
    throw new Error("The attached image data is invalid.");
  const buffer = Buffer.from(input.dataUrl.slice(prefix.length), "base64");
  if (
    !buffer.length ||
    buffer.length > 2_621_440 ||
    buffer.length !== input.size
  )
    throw new Error("The attached image is too large or invalid.");
  const signatureValid =
    input.mimeType === "image/png"
      ? buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
      : input.mimeType === "image/jpeg"
        ? buffer.subarray(0, 3).toString("hex") === "ffd8ff"
        : input.mimeType === "image/webp"
          ? buffer.toString("ascii", 0, 4) === "RIFF" &&
            buffer.toString("ascii", 8, 12) === "WEBP"
          : ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
  if (!signatureValid)
    throw new Error("The attached image does not match its file type.");
  return { dataUrl: input.dataUrl, mimeType: input.mimeType };
}

async function saveQuestionImage({
  supabase,
  organizationId,
  userId,
  questionId,
  image,
  originalName,
}: {
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >;
  organizationId: string;
  userId: string;
  questionId: string;
  image?: EmployeeQuestionImage;
  originalName?: string;
}) {
  if (!image) return;
  const extension: Record<EmployeeQuestionImage["mimeType"], string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const prefix = `data:${image.mimeType};base64,`;
  const buffer = Buffer.from(image.dataUrl.slice(prefix.length), "base64");
  const storagePath = `${organizationId}/${userId}/${randomUUID()}.${extension[image.mimeType]}`;
  const { error: uploadError } = await supabase.storage
    .from("ask-images")
    .upload(storagePath, buffer, {
      contentType: image.mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;
  const { error: attachmentError } = await supabase
    .from("question_attachments")
    .insert({
      organization_id: organizationId,
      question_id: questionId,
      storage_path: storagePath,
      mime_type: image.mimeType,
      original_name: originalName || "case-image",
      size_bytes: buffer.length,
    });
  if (attachmentError) {
    await supabase.storage.from("ask-images").remove([storagePath]);
    throw attachmentError;
  }
}

function sourceLabel(type: string, content: string) {
  const label: Record<string, string> = {
    process_summary: "Process overview",
    process_step: "Process step",
    rule: "Company rule",
    exception: "Process exception",
    owner_answer: "Owner answer",
    role_instruction: "Role instruction",
    call_finding: "Approved call learning",
  };
  return `${label[type] ?? "Company knowledge"} → ${content.split(/[.:]/)[0].slice(0, 80)}`;
}

function providerLabel(
  provider: string | null,
  learningSource?: string | null,
) {
  return provider === "notion"
    ? "Notion"
    : provider === "confluence"
      ? "Confluence"
      : provider === "google_drive" || learningSource === "google_drive"
        ? "Google Workspace"
        : "Opryn";
}

type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

async function buildSourceCards(
  supabase: SupabaseServerClient,
  items: RetrievedKnowledge[],
) {
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
      ? supabase
          .from("processes")
          .select("id,title,source_title,source_provider,learning_source")
          .in("id", processIds)
      : Promise.resolve({ data: [] }),
    sourceIds.length
      ? supabase.from("process_steps").select("id,title").in("id", sourceIds)
      : Promise.resolve({ data: [] }),
    [...new Set([...sourceIds, ...ruleIds])].length
      ? supabase
          .from("process_rules")
          .select("id,title")
          .in("id", [...new Set([...sourceIds, ...ruleIds])])
      : Promise.resolve({ data: [] }),
  ]);
  const processNames = new Map(
    (processes.data ?? []).map((row) => [row.id, row]),
  );
  const stepNames = new Map(
    (steps.data ?? []).map((row) => [row.id, row.title]),
  );
  const ruleNames = new Map(
    (rules.data ?? []).map((row) => [row.id, row.title]),
  );
  return items.map((item) => {
    const process = item.process_id ? processNames.get(item.process_id) : null;
    const sectionTitle =
      ruleNames.get(item.rule_id ?? item.source_id) ??
      stepNames.get(item.source_id);
    const sourceTitle = process?.source_title
      ? `${providerLabel(process.source_provider, process.learning_source)} · ${process.source_title}`
      : process?.title;
    const label = sourceTitle
      ? `${sourceTitle}${sectionTitle ? ` → ${sectionTitle}` : ""}`
      : (sectionTitle ?? sourceLabel(item.source_type, item.content));
    const anchor = ruleNames.has(item.rule_id ?? item.source_id)
      ? `#rule-${item.rule_id ?? item.source_id}`
      : stepNames.has(item.source_id)
        ? `#step-${item.source_id}`
        : "";
    return {
      id: item.id,
      label,
      href: item.process_id
        ? `/app/processes/${item.process_id}${anchor}`
        : item.rule_id
          ? `/app/processes#knowledge-${item.rule_id}`
          : null,
      content: item.content,
    };
  });
}

async function findBestExpert({
  supabase,
  organizationId,
  question,
  closestKnowledgeId,
}: {
  supabase: SupabaseServerClient;
  organizationId: string;
  question: string;
  closestKnowledgeId?: string;
}) {
  return findCompanyExpert(
    supabase,
    organizationId,
    question,
    closestKnowledgeId,
  );
}

async function recordEvents(
  supabase: SupabaseServerClient,
  events: Array<Record<string, unknown>>,
) {
  const { error } = await supabase.from("knowledge_events").insert(events);
  if (error)
    console.error("Unable to record Opryn learning events", {
      code: error.code,
    });
}
