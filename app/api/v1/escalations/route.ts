import { z } from "zod";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
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
  scope_context: scopeContextSchema.optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await authenticateExternalAI(request, "escalations:create");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const [questionEmbedding] = await embedKnowledge([parsed.data.question]);
    const { data: gap, error } = await auth.service.rpc("record_external_gap", {
      target_organization_id: auth.connection.organization_id,
      target_connection_id: auth.connection.id,
      target_key_id: auth.keyId,
      question_text: parsed.data.question,
      question_context: parsed.data.context ?? "",
      question_embedding: questionEmbedding,
      route_question: true,
      register_occurrence: false,
      applicability_context: parsed.data.scope_context ?? {},
    });
    if (error) throw error;
    await logExternalActivity(auth.service, {
      organizationId: auth.connection.organization_id,
      connectionId: auth.connection.id,
      endpoint: "escalations",
      resultStatus: "created",
      startedAt,
    });
    return externalJSON(
      { status: "created", escalation_id: gap.publicId, routed: gap.routed },
      { status: 201 },
    );
  } catch (error) {
    return externalAIError(error);
  }
}
