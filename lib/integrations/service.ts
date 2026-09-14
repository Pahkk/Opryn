import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { getIntegrationCatalogItem } from "@/lib/integrations/catalog";
import { getCredentialGuide } from "@/lib/integrations/guides";
import {
  credentialHint,
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "@/lib/integrations/credentials";
import type { SanitizedIntegrationConnection } from "@/lib/integrations/types";

export async function saveCredentialIntegration(input: {
  supabase: SupabaseClient;
  providerId: string;
  credentials: Record<string, string>;
  organizationId: string;
  userId: string;
}) {
  const catalogProvider = getIntegrationCatalogItem(input.providerId);
  const isCustom = input.providerId.startsWith("custom_");
  const provider =
    catalogProvider ?? (isCustom ? customProvider(input.providerId) : null);
  if (!provider || provider.authMode !== "credential_guide")
    throw new Error("This software does not use the guided credential flow.");
  const guide = getCredentialGuide(provider);
  const allowedKeys = new Set(guide.fields.map((field) => field.key));
  const credentials = Object.fromEntries(
    Object.entries(input.credentials)
      .filter(([key]) => allowedKeys.has(key))
      .map(([key, value]) => [key, String(value).trim()])
      .filter(([, value]) => value.length > 0),
  );
  for (const field of guide.fields) {
    if (field.required && !credentials[field.key])
      throw new Error(`${field.label} is required.`);
  }
  validateCredentialShapes(input.providerId, credentials);

  const { data: prior } = await input.supabase
    .from("integrations")
    .select("id,status,external_connection_id")
    .eq("organization_id", input.organizationId)
    .eq("provider", input.providerId)
    .maybeSingle();
  const now = new Date().toISOString();
  const hint = credentialHint(credentials);
  const { data: integration, error } = await input.supabase
    .from("integrations")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: input.providerId,
        connection_type: "credential_guide",
        auth_platform: "customer_managed",
        provider_config_key: input.providerId,
        external_connection_id:
          prior?.external_connection_id || `owner_${randomUUID()}`,
        external_account_name: isCustom
          ? provider.name
          : typeof hint.account === "string"
            ? hint.account
            : provider.name,
        status: "connected",
        capabilities: [...provider.capabilities],
        connected_by: input.userId,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "organization_id,provider" },
    )
    .select("id")
    .single();
  if (error || !integration)
    throw error ?? new Error("Connection could not be saved.");

  const service = createServiceClient();
  const { error: credentialError } = await service
    .from("integration_credentials")
    .upsert(
      {
        integration_id: integration.id,
        organization_id: input.organizationId,
        encrypted_payload: encryptIntegrationCredentials({
          organizationId: input.organizationId,
          providerId: input.providerId,
          credentials,
        }),
        credential_hint: hint,
        updated_at: now,
      },
      { onConflict: "integration_id" },
    );
  if (credentialError) {
    await input.supabase
      .from("integrations")
      .update({ status: "error", updated_at: now })
      .eq("id", integration.id);
    throw credentialError;
  }
  await recordIntegrationEvent(input.supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
    integrationId: integration.id,
    provider: input.providerId,
    eventType: prior ? "integration_reauthorized" : "integration_connected",
    metadata: { credentialMode: "customer_managed" },
  });
  return { id: integration.id as string, hint };
}

function customProvider(id: string) {
  const name =
    id
      .slice("custom_".length)
      .split("_")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ") || "Custom software";
  return {
    id,
    name,
    category: "business" as const,
    authMode: "credential_guide" as const,
    capabilities: [] as const,
    description: `Add a restricted ${name} API credential for Opryn.`,
    setupTime: "Guided setup",
    premium: false,
    permissions: {
      can: ["Use only the credential you provide"],
      cannot: ["Change company policy", "Access another Opryn organization"],
      privacy: "Credentials are encrypted and remain scoped to this business.",
    },
  };
}

export async function getIntegrationConnection(input: {
  supabase: SupabaseClient;
  organizationId: string;
  integrationId: string;
}) {
  const { data, error } = await input.supabase
    .from("integrations")
    .select(
      "id,provider,external_connection_id,external_account_id,external_account_name,status,capabilities,connected_at,last_used_at,last_sync_at",
    )
    .eq("id", input.integrationId)
    .eq("organization_id", input.organizationId)
    .single();
  if (error || !data) throw new Error("Connection not found.");
  return sanitizeIntegration(data);
}

export async function getIntegrationCapability(input: {
  supabase: SupabaseClient;
  organizationId: string;
  integrationId: string;
  capability: string;
}) {
  const connection = await getIntegrationConnection(input);
  return (
    connection.status === "connected" &&
    connection.capabilities.includes(input.capability)
  );
}

export async function getIntegrationCredentialsServerSide(input: {
  organizationId: string;
  integrationId: string;
}) {
  const service = createServiceClient();
  const { data: integration, error } = await service
    .from("integrations")
    .select("provider,status")
    .eq("id", input.integrationId)
    .eq("organization_id", input.organizationId)
    .single();
  if (error || !integration || integration.status !== "connected")
    throw new Error("An active connection was not found.");
  const { data: stored, error: storedError } = await service
    .from("integration_credentials")
    .select("encrypted_payload")
    .eq("integration_id", input.integrationId)
    .eq("organization_id", input.organizationId)
    .single();
  if (storedError || !stored)
    throw new Error("Connection credentials were not found.");
  return decryptIntegrationCredentials({
    organizationId: input.organizationId,
    providerId: integration.provider,
    encryptedPayload: stored.encrypted_payload,
  });
}

export async function disconnectIntegration(input: {
  supabase: SupabaseClient;
  integrationId: string;
  organizationId: string;
  userId: string;
}) {
  const { data: integration, error } = await input.supabase
    .from("integrations")
    .select("id,provider,auth_platform")
    .eq("id", input.integrationId)
    .eq("organization_id", input.organizationId)
    .single();
  if (error || !integration) throw new Error("Connection not found.");
  if (integration.auth_platform === "nango")
    throw new Error("Use the connection management screen to disconnect this provider.");
  const service = createServiceClient();
  const { error: deleteError } = await service
    .from("integration_credentials")
    .delete()
    .eq("integration_id", integration.id)
    .eq("organization_id", input.organizationId);
  if (deleteError) throw deleteError;
  const { error: updateError } = await input.supabase
    .from("integrations")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("id", integration.id)
    .eq("organization_id", input.organizationId);
  if (updateError) throw updateError;
  await recordIntegrationEvent(input.supabase, {
    organizationId: input.organizationId,
    userId: input.userId,
    integrationId: integration.id,
    provider: integration.provider,
    eventType: "integration_disconnected",
  });
}

function validateCredentialShapes(
  providerId: string,
  credentials: Record<string, string>,
) {
  for (const [key, value] of Object.entries(credentials))
    if (value.length > 20_000) throw new Error(`${key} is too long.`);
  if (providerId.startsWith("google_")) {
    let parsed: { client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(credentials.serviceAccountJson || "");
    } catch {
      throw new Error("Paste the complete Google service account JSON file.");
    }
    if (!parsed.client_email || !parsed.private_key)
      throw new Error(
        "That Google service account JSON is missing required fields.",
      );
  }
  for (const urlKey of ["baseUrl", "instanceUrl"]) {
    if (!credentials[urlKey]) continue;
    const url = new URL(credentials[urlKey]);
    if (url.protocol !== "https:")
      throw new Error("Account URLs must use HTTPS.");
  }
}

export function sanitizeIntegration(row: {
  id: string;
  provider: string;
  external_connection_id: string;
  external_account_id: string | null;
  external_account_name: string | null;
  status: SanitizedIntegrationConnection["status"];
  capabilities: string[] | null;
  connected_at: string | null;
  last_used_at: string | null;
  last_sync_at: string | null;
}): SanitizedIntegrationConnection {
  return {
    id: row.id,
    provider: row.provider,
    externalConnectionId: row.external_connection_id,
    externalAccountId: row.external_account_id,
    externalAccountName: row.external_account_name,
    status: row.status,
    capabilities: row.capabilities ?? [],
    connectedAt: row.connected_at,
    lastUsedAt: row.last_used_at,
    lastSyncAt: row.last_sync_at,
  };
}

export async function recordIntegrationEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    integrationId?: string | null;
    provider: string;
    eventType:
      | "integration_connection_started"
      | "integration_connected"
      | "integration_connection_failed"
      | "integration_reauthorized"
      | "integration_disconnected";
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase
    .from("integration_events")
    .insert({
      organization_id: input.organizationId,
      integration_id: input.integrationId ?? null,
      provider: input.provider,
      event_type: input.eventType,
      actor_id: input.userId,
      metadata: input.metadata ?? {},
    });
  if (error)
    console.error("[Opryn Integrations] Could not record audit event", {
      provider: input.provider,
      event: input.eventType,
      message: error.message,
    });
}
