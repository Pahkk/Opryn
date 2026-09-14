import { z } from "zod";
import {
  authenticateExternalAI,
  externalAIError,
  externalJSON,
} from "@/lib/external-ai/auth";
import {
  answerExternalQuestion,
  logExternalActivity,
  searchExternalKnowledgeWithEmbedding,
  sourceTitle,
} from "@/lib/external-ai/service";

const schema = z.object({
  question: z.string().trim().min(3).max(4000),
  context: z.string().trim().max(4000).optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await authenticateExternalAI(request, "knowledge:read");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const { knowledge, embedding } = await searchExternalKnowledgeWithEmbedding(
      auth.service,
      auth.connection.id,
      auth.connection.organization_id,
      `${parsed.data.question}\n${parsed.data.context ?? ""}`,
      15,
      auth.scopes,
    );
    const answer = knowledge.length
      ? await answerExternalQuestion(
          parsed.data.question,
          parsed.data.context,
          knowledge,
        )
      : null;
    const { data: criticalRows } = knowledge.length
      ? await auth.service
          .from("knowledge_chunks")
          .select("id")
          .eq("organization_id", auth.connection.organization_id)
          .eq("criticality", "critical")
          .in(
            "id",
            knowledge.map((item) => item.id),
          )
      : { data: [] };
    const answerThreshold = criticalRows?.length ? 0.9 : 0.72;
    if (
      !answer?.can_answer ||
      answer.confidence < answerThreshold ||
      !answer.answer
    ) {
      const { data: clusterId } = await auth.service.rpc(
        "record_question_cluster",
        {
          target_organization_id: auth.connection.organization_id,
          question_text: parsed.data.question,
          question_embedding: embedding,
          question_origin: "external_ai",
        },
      );
      await logExternalActivity(auth.service, {
        organizationId: auth.connection.organization_id,
        connectionId: auth.connection.id,
        endpoint: "answer",
        resultStatus: "unknown",
        startedAt,
      });
      await auth.service.from("knowledge_events").insert([
        {
          organization_id: auth.connection.organization_id,
          event_type: "agent_query",
          source_type: "external_ai_connection",
          source_id: auth.connection.id,
          metadata: { result: "unknown", cluster_id: clusterId },
        },
        {
          organization_id: auth.connection.organization_id,
          event_type: "agent_unknown",
          source_type: "external_ai_connection",
          source_id: auth.connection.id,
          metadata: { cluster_id: clusterId },
        },
      ]);
      return externalJSON({
        status: "unknown",
        answer: null,
        confidence: answer?.confidence ?? 0,
        can_escalate: auth.scopes.has("escalations:create"),
        critical: Boolean(criticalRows?.length),
        ...(knowledge[0] && auth.scopes.has("sources:read")
          ? {
              related_information: {
                content: knowledge[0].content,
                source: sourceTitle(knowledge[0]),
              },
            }
          : {}),
      });
    }
    const cited = knowledge.filter((item) =>
      answer.cited_source_ids.includes(item.id),
    );
    if (!cited.length)
      throw new Error("Generated answer did not cite approved knowledge.");
    const fullAnswer = [
      answer.answer,
      answer.steps.length
        ? answer.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
        : "",
      answer.important_note,
    ]
      .filter(Boolean)
      .join("\n\n");
    const requiresApproval = answer.requires_approval;
    await logExternalActivity(auth.service, {
      organizationId: auth.connection.organization_id,
      connectionId: auth.connection.id,
      endpoint: "answer",
      resultStatus: "answered",
      startedAt,
      sourceCount: cited.length,
    });
    await auth.service.rpc("record_knowledge_usage", {
      target_organization_id: auth.connection.organization_id,
      target_chunk_ids: cited.map((item) => item.id),
      usage_origin: "external_ai",
    });
    await auth.service.from("knowledge_events").insert({
      organization_id: auth.connection.organization_id,
      event_type: "agent_query",
      knowledge_chunk_id: cited[0].id,
      source_type: "external_ai_connection",
      source_id: auth.connection.id,
      metadata: { result: "answered", source_count: cited.length },
    });
    return externalJSON({
      status: "answered",
      answer: fullAnswer,
      confidence: answer.confidence,
      ...(requiresApproval
        ? {
            requires_approval: true,
            approval_reason:
              answer.approval_reason ||
              answer.important_note ||
              "Approved company knowledge requires approval for this request.",
          }
        : {}),
      sources: auth.scopes.has("sources:read") ? cited.map(sourceTitle) : [],
    });
  } catch (error) {
    return externalAIError(error);
  }
}
