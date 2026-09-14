import {
  OPRYN_MCP_ISSUER,
  OPRYN_MCP_RESOURCE,
  OPRYN_MCP_SCOPES,
} from "@/lib/opryn/mcp/config";

export function GET() {
  return Response.json(
    {
      resource: OPRYN_MCP_RESOURCE,
      authorization_servers: [OPRYN_MCP_ISSUER],
      scopes_supported: OPRYN_MCP_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "Opryn Approved Company Knowledge",
      resource_documentation: `${OPRYN_MCP_ISSUER}/docs/mcp-development`,
      resource_policy_uri: `${OPRYN_MCP_ISSUER}/privacy`,
      resource_tos_uri: `${OPRYN_MCP_ISSUER}/terms`,
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
