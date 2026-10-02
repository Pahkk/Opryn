import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpAuthContext } from "@/lib/opryn/oauth/tokens";
import { conversationIntentSchema } from "./conversation-learning";

export async function validateLearningHandoff(
  service: SupabaseClient,
  auth: McpAuthContext,
  requestId?: string,
) {
  if (!requestId) return null;
  const { data, error } = await service
    .from("onboarding_learning_sessions")
    .select("intent")
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) throw error;
  const parsed = conversationIntentSchema.safeParse(data?.intent);
  if (
    !parsed.success ||
    parsed.data.requestId !== requestId ||
    parsed.data.provider !== auth.clientKind ||
    parsed.data.stage !== "waiting" ||
    !parsed.data.expiresAt ||
    Date.parse(parsed.data.expiresAt) <= Date.now()
  )
    throw new Error(
      "This learning request expired or belongs to another setup. Prepare a new instruction in Opryn.",
    );
  return parsed.data;
}

export async function attachLearningHandoff(
  service: SupabaseClient,
  auth: McpAuthContext,
  intent: NonNullable<Awaited<ReturnType<typeof validateLearningHandoff>>>,
  jobId: string,
) {
  if (intent.jobId && intent.jobId !== jobId)
    throw new Error(
      "This request already received a conversation. Prepare a new request to send another.",
    );
  const { error } = await service
    .from("onboarding_learning_sessions")
    .update({
      intent: { ...intent, jobId },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", auth.organizationId)
    .eq("user_id", auth.userId)
    .eq("intent->>requestId", intent.requestId!);
  if (error) throw error;
}
