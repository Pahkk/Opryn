const baseUrl = (
  process.env.OPRYN_MCP_TEST_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

async function readJson(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} did not return JSON (${response.status}).`);
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const authorization = await readJson("/.well-known/oauth-authorization-server");
assert(
  authorization.response.ok,
  "OAuth authorization-server discovery failed.",
);
assert(
  authorization.body.code_challenge_methods_supported?.includes("S256"),
  "OAuth discovery must require S256 PKCE.",
);
assert(
  authorization.body.grant_types_supported?.includes("refresh_token"),
  "OAuth discovery must advertise refresh tokens.",
);

const protectedResource = await readJson(
  "/.well-known/oauth-protected-resource",
);
assert(protectedResource.response.ok, "Protected-resource discovery failed.");
assert(
  new URL(protectedResource.body.resource).pathname === "/api/mcp",
  "Protected-resource metadata points at an unexpected MCP resource.",
);

const unauthenticated = await readJson("/api/mcp", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "opryn-verification", version: "1.0" },
    },
  }),
});
assert(
  unauthenticated.response.status === 401,
  "Unauthenticated MCP request must return 401.",
);
assert(
  unauthenticated.response.headers
    .get("www-authenticate")
    ?.includes("resource_metadata="),
  "MCP 401 must include protected-resource discovery.",
);

const malformedRegistration = await readJson("/api/oauth/register", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    client_name: "Invalid test client",
    redirect_uris: ["javascript:alert(1)"],
  }),
});
assert(
  malformedRegistration.response.status === 400,
  "Unsafe OAuth redirect URI must be rejected.",
);

console.log(
  "Opryn MCP discovery, OAuth challenge, PKCE metadata, and redirect validation passed.",
);
