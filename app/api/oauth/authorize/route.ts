import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  MCP_AUTHORIZATION_CODE_SECONDS,
  inferMcpClientKind,
} from "@/lib/opryn/mcp/config";
import { hashOAuthValue, randomOAuthValue } from "@/lib/opryn/oauth/crypto";
import { parseAuthorizationRequest } from "@/lib/opryn/oauth/validation";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "invalid_request" }, { status: 403 });
  const form = await request.formData();
  const params = new URLSearchParams();
  for (const [key, value] of form.entries())
    if (typeof value === "string") params.set(key, value);
  let auth;
  try {
    auth = parseAuthorizationRequest(params);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const service = createServiceClient();
  const { data: client } = await service
    .from("mcp_oauth_clients")
    .select("id,client_name,redirect_uris")
    .eq("client_id", auth.clientId)
    .maybeSingle();
  if (!client || !(client.redirect_uris as string[]).includes(auth.redirectUri))
    return Response.json({ error: "invalid_client" }, { status: 400 });
  const destination = new URL(auth.redirectUri);
  if (auth.state) destination.searchParams.set("state", auth.state);
  destination.searchParams.set("iss", new URL(request.url).origin);
  if (form.get("decision") !== "approve") {
    destination.searchParams.set("error", "access_denied");
    return Response.redirect(destination, 303);
  }
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user)
    return Response.json({ error: "login_required" }, { status: 401 });
  const organizationId = String(form.get("organization_id") || "");
  const { data: membership } = await service
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (!membership)
    return Response.json({ error: "access_denied" }, { status: 403 });
  const { data: grant, error: grantError } = await service
    .from("mcp_oauth_grants")
    .upsert(
      {
        organization_id: organizationId,
        user_id: authData.user.id,
        client_id: client.id,
        client_kind: inferMcpClientKind(client.client_name),
        scopes: auth.scopes,
        resource: auth.resource,
        authorized_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: "organization_id,user_id,client_id,resource" },
    )
    .select("id")
    .single();
  if (grantError) throw grantError;
  await service
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("grant_id", grant.id)
    .is("revoked_at", null);
  const code = randomOAuthValue("opryn_mcp_code_");
  const { error: codeError } = await service
    .from("mcp_oauth_authorization_codes")
    .insert({
      grant_id: grant.id,
      code_hash: hashOAuthValue(code),
      redirect_uri: auth.redirectUri,
      code_challenge: auth.codeChallenge,
      code_challenge_method: "S256",
      scopes: auth.scopes,
      resource: auth.resource,
      expires_at: new Date(
        Date.now() + MCP_AUTHORIZATION_CODE_SECONDS * 1000,
      ).toISOString(),
    });
  if (codeError) throw codeError;
  destination.searchParams.set("code", code);
  return Response.redirect(destination, 303);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
