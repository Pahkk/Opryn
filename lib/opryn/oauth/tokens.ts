import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MCP_ACCESS_TOKEN_SECONDS,
  MCP_REFRESH_TOKEN_SECONDS,
  OPRYN_MCP_RESOURCE,
  type OprynMcpScope,
} from "@/lib/opryn/mcp/config";
import { hashOAuthValue, randomOAuthValue } from "@/lib/opryn/oauth/crypto";

export type McpAuthContext = {
  tokenId: string;
  grantId: string;
  organizationId: string;
  userId: string;
  roleId: string | null;
  permissionLevel: "owner" | "admin" | "employee";
  clientKind: "chatgpt" | "claude" | "custom_mcp";
  clientName: string;
  scopes: Set<string>;
};

export function issueOpaqueTokens() {
  return {
    accessToken: randomOAuthValue("opryn_mcp_at_"),
    refreshToken: randomOAuthValue("opryn_mcp_rt_"),
  };
}

export async function persistTokens(
  service: SupabaseClient,
  grantId: string,
  scopes: string[],
  previousTokenId?: string,
) {
  const tokens = issueOpaqueTokens();
  const now = Date.now();
  const { data, error } = await service
    .from("mcp_oauth_tokens")
    .insert({
      grant_id: grantId,
      access_token_hash: hashOAuthValue(tokens.accessToken),
      refresh_token_hash: hashOAuthValue(tokens.refreshToken),
      scopes,
      resource: OPRYN_MCP_RESOURCE,
      access_expires_at: new Date(
        now + MCP_ACCESS_TOKEN_SECONDS * 1000,
      ).toISOString(),
      refresh_expires_at: new Date(
        now + MCP_REFRESH_TOKEN_SECONDS * 1000,
      ).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  if (previousTokenId)
    await service
      .from("mcp_oauth_tokens")
      .update({ revoked_at: new Date().toISOString(), replaced_by: data.id })
      .eq("id", previousTokenId)
      .is("revoked_at", null);
  return { ...tokens, tokenId: data.id };
}

export async function authenticateMcpToken(
  service: SupabaseClient,
  rawToken: string,
): Promise<McpAuthContext | null> {
  if (!rawToken.startsWith("opryn_mcp_at_") || rawToken.length < 48)
    return null;
  const now = new Date().toISOString();
  const { data: token } = await service
    .from("mcp_oauth_tokens")
    .select("id,grant_id,scopes,resource,access_expires_at,revoked_at")
    .eq("access_token_hash", hashOAuthValue(rawToken))
    .is("revoked_at", null)
    .gt("access_expires_at", now)
    .maybeSingle();
  if (!token || token.resource !== OPRYN_MCP_RESOURCE) return null;
  const { data: grant } = await service
    .from("mcp_oauth_grants")
    .select(
      "id,organization_id,user_id,client_id,client_kind,scopes,resource,revoked_at",
    )
    .eq("id", token.grant_id)
    .is("revoked_at", null)
    .maybeSingle();
  if (!grant || grant.resource !== OPRYN_MCP_RESOURCE) return null;
  const [{ data: member }, { data: client }] = await Promise.all([
    service
      .from("organization_members")
      .select("permission_level,role_id")
      .eq("organization_id", grant.organization_id)
      .eq("user_id", grant.user_id)
      .maybeSingle(),
    service
      .from("mcp_oauth_clients")
      .select("client_name")
      .eq("id", grant.client_id)
      .maybeSingle(),
  ]);
  if (!member || !client) return null;
  const scopes = new Set<string>(token.scopes || []);
  const allowedByGrant = new Set<string>(grant.scopes || []);
  for (const scope of scopes) if (!allowedByGrant.has(scope)) return null;
  const usedAt = new Date().toISOString();
  await Promise.all([
    service
      .from("mcp_oauth_tokens")
      .update({ last_used_at: usedAt })
      .eq("id", token.id),
    service
      .from("mcp_oauth_grants")
      .update({ last_used_at: usedAt })
      .eq("id", grant.id),
    service
      .from("mcp_oauth_clients")
      .update({ last_used_at: usedAt })
      .eq("id", grant.client_id),
  ]);
  return {
    tokenId: token.id,
    grantId: grant.id,
    organizationId: grant.organization_id,
    userId: grant.user_id,
    roleId: member.role_id,
    permissionLevel: member.permission_level,
    clientKind: grant.client_kind,
    clientName: client.client_name,
    scopes,
  } as McpAuthContext;
}

export function requireMcpScope(context: McpAuthContext, scope: OprynMcpScope) {
  if (!context.scopes.has(scope)) {
    const error = new Error(`Missing required scope: ${scope}`);
    error.name = "McpInsufficientScopeError";
    throw error;
  }
}
