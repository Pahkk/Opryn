import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  authenticateExternalAI,
  externalAIError,
  externalJSON,
} from "@/lib/external-ai/auth";
import { logExternalActivity } from "@/lib/external-ai/service";
import { embedKnowledge } from "@/lib/ai/services";

const schema = z.object({
  question: z.string().trim().min(3).max(4000),
  context: z.string().trim().max(4000).optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await authenticateExternalAI(request, "escalations:create");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const publicId = `esc_${randomBytes(12).toString("base64url")}`;
    const [questionEmbedding] = await embedKnowledge([parsed.data.question]);
    let { data: clusterId } = await auth.service.rpc("find_question_cluster", {
      target_organization_id: auth.connection.organization_id,
      question_embedding: questionEmbedding,
    });
    if (!clusterId) {
      const result = await auth.service.rpc("record_question_cluster", {
        target_organization_id: auth.connection.organization_id,
        question_text: parsed.data.question,
        question_embedding: questionEmbedding,
        question_origin: "external_ai",
      });
      clusterId = result.data;
    }
    const { data: owners } = await auth.service
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", auth.connection.organization_id)
      .in("permission_level", ["owner", "admin"]);
    const assignedTo = owners?.[0]?.user_id ?? null;
    const { data, error } = await auth.service
      .from("external_ai_escalations")
      .insert({
        public_id: publicId,
        organization_id: auth.connection.organization_id,
        connection_id: auth.connection.id,
        question: parsed.data.question,
        context: parsed.data.context ?? "",
        assigned_to: assignedTo,
        cluster_id: clusterId,
      })
      .select("public_id")
      .single();
    if (error) throw error;
    if (assignedTo)
      await auth.service.from("notifications").insert({
        organization_id: auth.connection.organization_id,
        user_id: assignedTo,
        type: "external_ai_escalation",
        title: "AI needs you",
        body: `${auth.connection.name} could not answer: ${parsed.data.question.slice(0, 220)}`,
        link: `/app/ai-connections/${auth.connection.id}?tab=escalations`,
      });
    await logExternalActivity(auth.service, {
      organizationId: auth.connection.organization_id,
      connectionId: auth.connection.id,
      endpoint: "escalations",
      resultStatus: "created",
      startedAt,
    });
    return externalJSON(
      { status: "created", escalation_id: data.public_id },
      { status: 201 },
    );
  } catch (error) {
    return externalAIError(error);
  }
}
