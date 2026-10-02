import {
  authenticateExternalAI,
  externalAIError,
  externalJSON,
} from "@/lib/external-ai/auth";

/** Polling is explicit; Opryn does not pretend to have pushed a message to an external agent. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateExternalAI(request, "escalations:create");
    const { id } = await params;
    if (!/^esc_[A-Za-z0-9_-]{12,80}$/.test(id))
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const { data: item, error } = await auth.service
      .from("external_ai_escalations")
      .select(
        "id,status,resolution,reusable_intent,knowledge_proposal_id,origin_api_key_id",
      )
      .eq("public_id", id)
      .eq("connection_id", auth.connection.id)
      .eq("organization_id", auth.connection.organization_id)
      .maybeSingle();
    if (error) throw error;
    if (!item || item.origin_api_key_id !== auth.keyId)
      return externalJSON({ error: "not_found" }, { status: 404 });
    const verified = await auth.service
      .from("knowledge_gap_rechecks")
      .select("status")
      .eq("organization_id", auth.connection.organization_id)
      .eq("external_escalation_id", item.id)
      .eq("status", "answered")
      .limit(1);
    if (verified.error) throw verified.error;
    // Verification is historical; never return its answer after a permission/source change.
    return externalJSON({
      status: item.status,
      human_response: item.status === "answered" ? item.resolution : null,
      authority: "human_response_for_this_interaction",
      reusable_intent: item.reusable_intent,
      proposal_id: item.knowledge_proposal_id,
      previously_verified: Boolean(verified.data?.length),
      next_action:
        "Ask the original question again for a current permission-scoped approved answer.",
    });
  } catch (error) {
    return externalAIError(error);
  }
}
