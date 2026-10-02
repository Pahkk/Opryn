import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  providerProxyRequest,
  requireNangoCapability,
} from "@/lib/integrations/nango-capabilities";

export async function reconcileTeamsNangoConnection(input: {
  organizationId: string;
  userId: string;
  integrationId: string;
}) {
  const db = createServiceClient();
  const connection = await requireNangoCapability(
    db,
    input.organizationId,
    input.integrationId,
    "ask_opryn",
  );
  if (connection.provider !== "teams") return;
  const response = await providerProxyRequest(
    connection,
    "/v1.0/organization?$select=id,displayName",
  );
  const graph = z
    .object({
      value: z
        .array(z.object({ id: z.string(), displayName: z.string().optional() }))
        .min(1),
    })
    .parse(await response.json());
  const tenant = graph.value[0];
  const saved = await db.from("communication_integrations").upsert(
    {
      organization_id: input.organizationId,
      provider: "teams",
      external_workspace_id: tenant.id,
      external_workspace_name: tenant.displayName || "Microsoft Teams",
      encrypted_credentials: null,
      nango_integration_id: input.integrationId,
      status: "active",
      installed_by: input.userId,
    },
    { onConflict: "organization_id,provider" },
  );
  if (saved.error) throw saved.error;
  await db
    .from("integrations")
    .update({
      external_account_id: tenant.id,
      external_account_name: tenant.displayName || "Microsoft Teams",
    })
    .eq("id", input.integrationId)
    .eq("organization_id", input.organizationId);
}

export async function disconnectTeamsNango(
  organizationId: string,
  integrationId: string,
) {
  const result = await createServiceClient()
    .from("communication_integrations")
    .update({ status: "disconnected" })
    .eq("organization_id", organizationId)
    .eq("provider", "teams")
    .eq("nango_integration_id", integrationId);
  if (result.error) throw result.error;
}
