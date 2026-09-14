import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getNangoProvider } from "@/lib/integrations/nango-providers";
import {
  ConnectionError,
  nangoEnvironment,
  nangoRequest,
  readNangoConnection,
} from "@/lib/integrations/nango";

export async function requireNangoCapability(
  db: SupabaseClient,
  organizationId: string,
  id: string,
  capability: "knowledge_import",
) {
  const { data, error } = await db
    .from("integrations")
    .select(
      "id,organization_id,provider,auth_platform,provider_config_key,external_connection_id,status,capabilities,configuration",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("auth_platform", "nango")
    .single();
  if (error || !data) throw new ConnectionError("Connection not found.", 404);
  const provider = getNangoProvider(data.provider);
  if (
    data.status !== "connected" ||
    !data.capabilities.includes(capability) ||
    !provider.capabilities.includes(capability) ||
    data.provider_config_key !== provider.integrationId ||
    data.configuration?.environment !== nangoEnvironment()
  )
    throw new ConnectionError(
      "This connection is not ready for that action.",
      403,
    );
  const remote = await readNangoConnection(
    provider.integrationId,
    data.external_connection_id,
  );
  if (
    remote.tags.organization_id !== organizationId ||
    remote.connection_id !== data.external_connection_id ||
    remote.provider_config_key !== provider.integrationId ||
    remote.errors.some((error) => error.type === "auth")
  )
    throw new ConnectionError(
      "Your connection needs to be authorized again.",
      403,
    );
  return data;
}

/** Only called by the Drive adapter with fixed API paths, never a browser-supplied URL. */
export async function driveRequest(
  connection: Awaited<ReturnType<typeof requireNangoCapability>>,
  path: string,
) {
  return nangoRequest(`/proxy/drive/v3/${path}`, {
    headers: {
      "Provider-Config-Key": connection.provider_config_key,
      "Connection-Id": connection.external_connection_id,
    },
  });
}
