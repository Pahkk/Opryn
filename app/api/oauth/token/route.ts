import { createServiceClient } from "@/lib/supabase/service";
import {
  MCP_ACCESS_TOKEN_SECONDS,
  OPRYN_MCP_RESOURCE,
  normalizeScopes,
} from "@/lib/opryn/mcp/config";
import { hashOAuthValue, verifyPkce } from "@/lib/opryn/oauth/crypto";
import { persistTokens } from "@/lib/opryn/oauth/tokens";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return tokenError("invalid_request", 400);
  const grantType = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  const resource = String(form.get("resource") || "");
  if (!clientId || resource !== OPRYN_MCP_RESOURCE)
    return tokenError("invalid_target", 400);
  const service = createServiceClient();
  const { data: client } = await service
    .from("mcp_oauth_clients")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client) return tokenError("invalid_client", 401);
  if (grantType === "authorization_code") {
    const code = String(form.get("code") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const verifier = String(form.get("code_verifier") || "");
    const { data: codeRow } = await service
      .from("mcp_oauth_authorization_codes")
      .select(
        "id,grant_id,redirect_uri,code_challenge,scopes,resource,expires_at,used_at",
      )
      .eq("code_hash", hashOAuthValue(code))
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (
      !codeRow ||
      codeRow.redirect_uri !== redirectUri ||
      codeRow.resource !== resource ||
      !verifyPkce(verifier, codeRow.code_challenge)
    )
      return tokenError("invalid_grant", 400);
    const { data: grant } = await service
      .from("mcp_oauth_grants")
      .select("id,client_id,revoked_at")
      .eq("id", codeRow.grant_id)
      .maybeSingle();
    if (!grant || grant.client_id !== client.id || grant.revoked_at)
      return tokenError("invalid_grant", 400);
    const { data: consumed } = await service
      .from("mcp_oauth_authorization_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!consumed) return tokenError("invalid_grant", 400);
    const issued = await persistTokens(service, grant.id, codeRow.scopes);
    return tokenResponse(
      issued.accessToken,
      issued.refreshToken,
      codeRow.scopes,
    );
  }
  if (grantType === "refresh_token") {
    const rawRefresh = String(form.get("refresh_token") || "");
    const { data: oldToken } = await service
      .from("mcp_oauth_tokens")
      .select("id,grant_id,scopes,resource,refresh_expires_at,revoked_at")
      .eq("refresh_token_hash", hashOAuthValue(rawRefresh))
      .is("revoked_at", null)
      .gt("refresh_expires_at", new Date().toISOString())
      .maybeSingle();
    if (!oldToken || oldToken.resource !== resource)
      return tokenError("invalid_grant", 400);
    const { data: grant } = await service
      .from("mcp_oauth_grants")
      .select("id,client_id,scopes,revoked_at")
      .eq("id", oldToken.grant_id)
      .maybeSingle();
    if (!grant || grant.client_id !== client.id || grant.revoked_at)
      return tokenError("invalid_grant", 400);
    const requested = form.get("scope")
      ? normalizeScopes(String(form.get("scope")))
      : oldToken.scopes;
    if (requested.some((scope: string) => !oldToken.scopes.includes(scope)))
      return tokenError("invalid_scope", 400);
    const { data: locked } = await service
      .from("mcp_oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", oldToken.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (!locked) return tokenError("invalid_grant", 400);
    const issued = await persistTokens(service, grant.id, requested);
    await service
      .from("mcp_oauth_tokens")
      .update({ replaced_by: issued.tokenId })
      .eq("id", oldToken.id);
    return tokenResponse(issued.accessToken, issued.refreshToken, requested);
  }
  return tokenError("unsupported_grant_type", 400);
}

function tokenResponse(
  accessToken: string,
  refreshToken: string,
  scopes: string[],
) {
  return Response.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: MCP_ACCESS_TOKEN_SECONDS,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    },
    { headers: { "cache-control": "no-store", pragma: "no-cache" } },
  );
}

function tokenError(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}
