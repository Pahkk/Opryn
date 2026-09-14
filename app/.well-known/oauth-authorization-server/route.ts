import { OPRYN_MCP_ISSUER, OPRYN_MCP_SCOPES } from "@/lib/opryn/mcp/config";

export function GET() {
  return Response.json(
    {
      issuer: OPRYN_MCP_ISSUER,
      authorization_endpoint: `${OPRYN_MCP_ISSUER}/oauth/authorize`,
      token_endpoint: `${OPRYN_MCP_ISSUER}/api/oauth/token`,
      revocation_endpoint: `${OPRYN_MCP_ISSUER}/api/oauth/revoke`,
      registration_endpoint: `${OPRYN_MCP_ISSUER}/api/oauth/register`,
      scopes_supported: OPRYN_MCP_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${OPRYN_MCP_ISSUER}/docs/mcp-development`,
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
