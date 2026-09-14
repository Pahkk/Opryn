import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createServiceClient } from "@/lib/supabase/service";
import { hashAgentKey } from "@/lib/external-ai/keys";
import type { ExternalAIScope } from "@/lib/external-ai/constants";

export class ExternalAIAuthError extends Error {
  constructor(
    readonly code:
      | "invalid_api_key"
      | "connection_paused"
      | "premium_required"
      | "insufficient_scope"
      | "rate_limited",
    readonly status: number,
  ) {
    super(code);
  }
}

type ConnectionRow = {
  id: string;
  agent_id: string;
  organization_id: string;
  name: string;
  status: "active" | "paused";
};

export type ExternalAIContext = {
  service: SupabaseClient;
  keyId: string;
  connection: ConnectionRow;
  scopes: Set<string>;
};

export async function authenticateExternalAI(
  request: Request,
  requiredScope: ExternalAIScope,
): Promise<ExternalAIContext> {
  const authorization = request.headers.get("authorization") ?? "";
  const rawKey = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!rawKey.startsWith("opryn_agent_") || rawKey.length < 40)
    throw new ExternalAIAuthError("invalid_api_key", 401);

  const service = createServiceClient();
  const keyHash = hashAgentKey(rawKey);
  const { data: key } = await service
    .from("external_ai_api_keys")
    .select("id,organization_id,connection_id,revoked_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!key) throw new ExternalAIAuthError("invalid_api_key", 401);

  const [{ data: connection }, { data: scopeRows }, plan] = await Promise.all([
    service
      .from("external_ai_connections")
      .select("id,agent_id,organization_id,name,status")
      .eq("id", key.connection_id)
      .eq("organization_id", key.organization_id)
      .maybeSingle(),
    service
      .from("external_ai_scopes")
      .select("scope")
      .eq("connection_id", key.connection_id)
      .eq("organization_id", key.organization_id),
    getOrganizationPlan(service, key.organization_id),
  ]);
  if (!connection) throw new ExternalAIAuthError("invalid_api_key", 401);
  if (connection.status !== "active")
    throw new ExternalAIAuthError("connection_paused", 403);
  if (plan.plan !== "premium")
    throw new ExternalAIAuthError("premium_required", 403);
  const scopes = new Set((scopeRows ?? []).map((item) => item.scope));
  if (!scopes.has(requiredScope))
    throw new ExternalAIAuthError("insufficient_scope", 403);

  const { data: allowed } = await service.rpc(
    "consume_external_ai_rate_limit",
    { target_key_id: key.id, minute_limit: 60, hour_limit: 1000 },
  );
  if (!allowed) {
    const pathname = new URL(request.url).pathname;
    const endpoint = pathname.endsWith("/knowledge/search")
      ? "knowledge_search"
      : pathname.endsWith("/escalations")
        ? "escalations"
        : "answer";
    await service.from("external_ai_activity").insert({
      organization_id: connection.organization_id,
      connection_id: connection.id,
      endpoint,
      result_status: "rate_limited",
      latency_ms: 0,
      source_count: 0,
    });
    throw new ExternalAIAuthError("rate_limited", 429);
  }
  const usedAt = new Date().toISOString();
  await Promise.all([
    service
      .from("external_ai_api_keys")
      .update({ last_used_at: usedAt })
      .eq("id", key.id),
    service
      .from("external_ai_connections")
      .update({ last_used_at: usedAt })
      .eq("id", connection.id),
  ]);
  return {
    service,
    keyId: key.id,
    connection: connection as ConnectionRow,
    scopes,
  };
}

export function externalAIError(error: unknown) {
  if (error instanceof ExternalAIAuthError)
    return externalJSON({ error: error.code }, { status: error.status });
  console.error("[Opryn External AI] request failed", {
    message: error instanceof Error ? error.message : "Unknown error",
  });
  return externalJSON({ error: "request_failed" }, { status: 500 });
}

export function externalJSON(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store, private");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(body, { ...init, headers });
}
