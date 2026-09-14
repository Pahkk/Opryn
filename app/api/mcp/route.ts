import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServiceClient } from "@/lib/supabase/service";
import { OPRYN_MCP_RESOURCE, OPRYN_MCP_SCOPES } from "@/lib/opryn/mcp/config";
import { authenticateMcpToken } from "@/lib/opryn/oauth/tokens";
import { createOprynMcpServer } from "@/lib/opryn/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request) {
  if (!validHost(request))
    return Response.json({ error: "invalid_host" }, { status: 400 });
  const authorization = request.headers.get("authorization") || "";
  const rawToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!rawToken)
    return Response.json(
      {
        error: "invalid_token",
        error_description: "Connect Opryn to continue.",
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "WWW-Authenticate": `Bearer resource_metadata="${new URL("/.well-known/oauth-protected-resource", OPRYN_MCP_RESOURCE).toString()}", scope="${OPRYN_MCP_SCOPES.join(" ")}"`,
        },
      },
    );
  const service = createServiceClient();
  const auth = await authenticateMcpToken(service, rawToken);
  if (!auth)
    return Response.json(
      {
        error: "invalid_token",
        error_description: "Reconnect Opryn to continue.",
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
          "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${new URL("/.well-known/oauth-protected-resource", OPRYN_MCP_RESOURCE).toString()}"`,
        },
      },
    );
  const server = createOprynMcpServer(service, auth);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request, {
      authInfo: {
        token: rawToken,
        clientId: auth.clientKind,
        scopes: [...auth.scopes],
        extra: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          grantId: auth.grantId,
        },
      },
    });
  } catch (error) {
    console.error("[Opryn MCP] Transport failed", {
      organizationId: auth.organizationId,
      grantId: auth.grantId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return Response.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Opryn MCP request failed." },
        id: null,
      },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { allow: "GET, POST, DELETE, OPTIONS" },
  });
}

function validHost(request: Request) {
  if (process.env.VERCEL_ENV !== "production") return true;
  return new URL(request.url).host === new URL(OPRYN_MCP_RESOURCE).host;
}
