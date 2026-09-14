import "server-only";

import { z } from "zod";
import { OPRYN_MCP_RESOURCE, normalizeScopes } from "@/lib/opryn/mcp/config";

export const dynamicClientSchema = z.object({
  client_name: z.string().trim().min(1).max(160),
  redirect_uris: z.array(z.string()).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").optional().default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .optional()
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).optional().default(["code"]),
  software_id: z.string().trim().max(200).optional(),
  client_uri: z.string().url().max(1000).optional(),
});

export function validateRedirectUri(value: string) {
  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export type AuthorizationRequest = ReturnType<typeof parseAuthorizationRequest>;

export function parseAuthorizationRequest(params: URLSearchParams) {
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const responseType = params.get("response_type") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const method = params.get("code_challenge_method") || "";
  const resource = params.get("resource") || "";
  if (!clientId || !redirectUri || responseType !== "code")
    throw new Error("The authorization request is incomplete.");
  if (method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge))
    throw new Error("This connection must use secure S256 PKCE.");
  if (resource !== OPRYN_MCP_RESOURCE)
    throw new Error("The authorization request is for the wrong resource.");
  return {
    clientId,
    redirectUri,
    responseType,
    codeChallenge,
    codeChallengeMethod: "S256" as const,
    resource,
    state: params.get("state") || "",
    scopes: normalizeScopes(params.get("scope")),
  };
}
