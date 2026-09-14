import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (
  process.env.OPRYN_MCP_TEST_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hashSecret =
  process.env.MCP_TOKEN_HASH_SECRET || process.env.EXTERNAL_AGENT_KEY_PEPPER;

if (!supabaseUrl || !serviceKey || !hashSecret) {
  throw new Error(
    "Authenticated MCP verification requires Supabase service credentials and MCP_TOKEN_HASH_SECRET (or the development fallback).",
  );
}

const service = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const created = { clientId: null, grantId: null };

try {
  const { data: subscription, error: subscriptionError } = await service
    .from("organization_subscriptions")
    .select("organization_id")
    .eq("plan", "premium")
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription)
    throw new Error(
      "No active Premium workspace is available for MCP verification.",
    );

  const { data: member, error: memberError } = await service
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", subscription.organization_id)
    .in("permission_level", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member)
    throw new Error("The Premium test workspace has no owner or admin.");

  const clientIdentifier = `mcp_client_${randomBytes(18).toString("base64url")}`;
  const { data: client, error: clientError } = await service
    .from("mcp_oauth_clients")
    .insert({
      client_id: clientIdentifier,
      client_name: "Opryn MCP verification",
      redirect_uris: ["http://127.0.0.1:6276/oauth/callback"],
    })
    .select("id")
    .single();
  if (clientError) throw clientError;
  created.clientId = client.id;

  const scopes = [
    "opryn.knowledge.read",
    "opryn.processes.read",
    "opryn.sources.read",
    "opryn.escalations.create",
    "opryn.learning.create",
  ];
  const { data: grant, error: grantError } = await service
    .from("mcp_oauth_grants")
    .insert({
      organization_id: subscription.organization_id,
      user_id: member.user_id,
      client_id: client.id,
      client_kind: "custom_mcp",
      scopes,
      resource: "https://www.opryn.app/api/mcp",
    })
    .select("id")
    .single();
  if (grantError) throw grantError;
  created.grantId = grant.id;

  const accessToken = `opryn_mcp_at_${randomBytes(32).toString("base64url")}`;
  const refreshToken = `opryn_mcp_rt_${randomBytes(32).toString("base64url")}`;
  const digest = (value) =>
    createHmac("sha256", hashSecret).update(value).digest("hex");
  const now = Date.now();
  const { error: tokenError } = await service.from("mcp_oauth_tokens").insert({
    grant_id: grant.id,
    access_token_hash: digest(accessToken),
    refresh_token_hash: digest(refreshToken),
    scopes,
    resource: "https://www.opryn.app/api/mcp",
    access_expires_at: new Date(now + 5 * 60 * 1000).toISOString(),
    refresh_expires_at: new Date(now + 10 * 60 * 1000).toISOString(),
  });
  if (tokenError) throw tokenError;

  const response = await fetch(`${baseUrl}/api/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(
      `Authenticated tools/list failed with HTTP ${response.status}.`,
    );
  }
  const names = new Set(payload.result?.tools?.map((tool) => tool.name));
  const required = [
    "ask_opryn",
    "search_company_knowledge",
    "check_company_policy",
    "get_company_process",
    "request_owner_guidance",
    "learn_from_context",
    "create_process",
    "create_process_from_context",
    "approve_process",
    "approve_knowledge_proposal",
    "deny_knowledge_proposal",
    "deny_process",
    "answer_only_knowledge_proposal",
  ];
  for (const name of required) {
    if (!names.has(name)) throw new Error(`Missing MCP tool: ${name}`);
  }
  console.log("Authenticated Opryn MCP tools/list passed with approval tools.");
} finally {
  if (created.grantId) {
    await service.from("mcp_oauth_grants").delete().eq("id", created.grantId);
  }
  if (created.clientId) {
    await service.from("mcp_oauth_clients").delete().eq("id", created.clientId);
  }
}
