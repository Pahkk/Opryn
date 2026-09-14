import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  createCommunicationToken,
  encryptProviderCredentials,
  hashCommunicationToken,
} from "@/lib/communication/crypto";
import type {
  CommunicationProvider,
  ProviderCredentials,
} from "@/lib/communication/types";

export async function createOAuthState(input: {
  organizationId: string;
  userId: string;
  provider: CommunicationProvider;
  returnTo?: string;
}) {
  const token = createCommunicationToken(32);
  const { error } = await createServiceClient()
    .from("communication_oauth_states")
    .insert({
      organization_id: input.organizationId,
      provider: input.provider,
      token_hash: hashCommunicationToken(token),
      created_by: input.userId,
      return_to: safeReturnTo(input.returnTo),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
  if (error) throw error;
  return token;
}

export async function consumeOAuthState(
  token: string,
  provider: CommunicationProvider,
) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("communication_oauth_states")
    .select("id,organization_id,created_by,return_to,expires_at,consumed_at")
    .eq("token_hash", hashCommunicationToken(token))
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  if (
    !data ||
    data.consumed_at ||
    new Date(data.expires_at).getTime() <= Date.now()
  )
    return null;
  const { data: consumed, error: consumeError } = await service
    .from("communication_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("consumed_at", null)
    .select("organization_id,created_by,return_to")
    .maybeSingle();
  if (consumeError) throw consumeError;
  return consumed;
}

function safeReturnTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value.slice(0, 1000);
}

export async function saveCommunicationIntegration(input: {
  organizationId: string;
  userId: string;
  provider: CommunicationProvider;
  workspaceId: string;
  workspaceName: string;
  botUserId?: string | null;
  credentials: ProviderCredentials;
}) {
  const service = createServiceClient();
  const encrypted = encryptProviderCredentials(input.credentials);
  const { data, error } = await service
    .from("communication_integrations")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: input.provider,
        external_workspace_id: input.workspaceId,
        external_workspace_name: input.workspaceName,
        bot_user_id: input.botUserId ?? null,
        encrypted_credentials: encrypted,
        status: "active",
        installed_by: input.userId,
      },
      { onConflict: "organization_id,provider" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
