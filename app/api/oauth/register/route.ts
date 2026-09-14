import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import {
  dynamicClientSchema,
  validateRedirectUri,
} from "@/lib/opryn/oauth/validation";

export async function POST(request: Request) {
  const parsed = dynamicClientSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || !parsed.data.redirect_uris.every(validateRedirectUri))
    return oauthJson(
      {
        error: "invalid_client_metadata",
        error_description: "Invalid client metadata or redirect URI.",
      },
      400,
    );
  const clientId = `mcp_client_${randomBytes(18).toString("base64url")}`;
  const service = createServiceClient();
  const { error } = await service.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: parsed.data.client_name,
    redirect_uris: parsed.data.redirect_uris,
    grant_types: parsed.data.grant_types,
    response_types: parsed.data.response_types,
    token_endpoint_auth_method: "none",
    software_id: parsed.data.software_id ?? null,
    client_uri: parsed.data.client_uri ?? null,
  });
  if (error) {
    console.error("[Opryn MCP] Client registration failed", {
      code: error.code,
    });
    return oauthJson({ error: "server_error" }, 500);
  }
  return oauthJson(
    {
      client_id: clientId,
      client_name: parsed.data.client_name,
      redirect_uris: parsed.data.redirect_uris,
      grant_types: parsed.data.grant_types,
      response_types: parsed.data.response_types,
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

function oauthJson(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
