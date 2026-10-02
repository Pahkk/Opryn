import { hasFeature } from "@/lib/billing/plans";
import { z } from "zod";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
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
  scope_context: scopeContextSchema.optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await authenticateExternalAI(request, "knowledge:read");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const { knowledge, embedding, versions } =
      await searchExternalKnowledgeWithEmbedding(
        auth.service,
        auth.connection.id,
        auth.connection.organization_id,
        `${parsed.data.question}\n${parsed.data.context ?? ""}`,
        15,
        auth.scopes,
        parsed.data.scope_context,
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
      !answer.answer ||
      !knowledge.some((item) => answer.cited_source_ids.includes(item.id))
    ) {
      const { data: gap, error: gapError } = await auth.service.rpc(
        "record_external_gap",
        {
          target_organization_id: auth.connection.organization_id,
          target_connection_id: auth.connection.id,
          target_key_id: auth.keyId,
          question_text: parsed.data.question,
          question_context: parsed.data.context ?? "",
          question_embedding: embedding,
          route_question: auth.scopes.has("escalations:create"),
          register_occurrence: true,
          applicability_context: parsed.data.scope_context ?? {},
        },
      );
      if (gapError) throw gapError;
      const clusterId = gap.clusterId;
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
        can_escalate:
          auth.scopes.has("escalations:create") &&
          auth.connection.unknown_behavior !== "record_only",
        routed: gap.routed,
        escalation_id: gap.publicId,
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
    // Never release a generated answer after access, key or guidance changed.
    const fresh = await auth.service.rpc("match_external_ai_knowledge", {
      target_connection_id: auth.connection.id,
      target_organization_id: auth.connection.organization_id,
      query_embedding: embedding,
      target_source_types: knowledge.map((k) => k.source_type),
      match_threshold: 0.3,
      match_count: 20,
    });
    const current = await auth.service
      .from("knowledge_chunks")
      .select("id,current_version")
      .eq("organization_id", auth.connection.organization_id)
      .in(
        "id",
        cited.map((k) => k.id),
      );
    const key = await auth.service
      .from("external_ai_api_keys")
      .select("id")
      .eq("organization_id", auth.connection.organization_id)
      .eq("connection_id", auth.connection.id)
      .eq("id", auth.keyId)
      .is("revoked_at", null)
      .maybeSingle();
    const plan = await getOrganizationPlan(
      auth.service,
      auth.connection.organization_id,
    );
    const trusted = await trustedAnswerContext(
      auth.service,
      auth.connection.organization_id,
      cited,
      { ...parsed.data.scope_context, channels: ["external_ai"] },
    );
    if (
      fresh.error ||
      current.error ||
      key.error ||
      !key.data ||
      !hasFeature(plan.plan, "aiConnections") ||
      trusted.length !== cited.length ||
      cited.some(
        (k) =>
          !fresh.data?.some(
            (v: { id: string; content: string }) =>
              v.id === k.id && v.content === k.content,
          ) ||
          current.data?.find((v) => v.id === k.id)?.current_version !==
            versions.find((v) => v.id === k.id)?.version,
      )
    )
      return externalJSON(
        { error: "access_or_knowledge_changed", answer: null },
        { status: 409 },
      );
    await logExternalActivity(auth.service, {
      organizationId: auth.connection.organization_id,
      connectionId: auth.connection.id,
      endpoint: "answer",
      resultStatus: "answered",
      startedAt,
      sourceCount: cited.length,
      knowledgeVersions: versions.filter((v) =>
        cited.some((k) => k.id === v.id),
      ),
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
