// Real MCP SDK transport + real tool registry; explicit service/model doubles.
// No provider, production database, Stripe payment or model request is made.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
const require = createRequire(import.meta.url);
let plan = "core",
  submitted = 0,
  scheduled = [],
  workspaceAllowed = true;
const auth = {
  organizationId: "org-a",
  userId: "user-a",
  grantId: "grant-a",
  clientKind: "claude",
  permissionLevel: "owner",
  scopes: new Set(["opryn.learning.create"]),
};
globalThis.__premiumLearningMocks = {
  "@/lib/billing/subscription": { getOrganizationPlan: async () => ({ plan }) },
  "@/lib/opryn/oauth/tokens": {
    requireMcpScope: (ctx, scope) => {
      if (!ctx.scopes.has(scope)) {
        const e = new Error("Missing consent");
        e.name = "McpInsufficientScopeError";
        throw e;
      }
    },
  },
  "@/lib/onboarding/learning-handoff": {
    validateLearningHandoff: async (_, ctx, ref) => {
      assert.equal(ctx.organizationId, "org-a");
      if (ref) throw new Error("Expired or wrong workspace");
      return null;
    },
    attachLearningHandoff: async () => {},
  },
  "@/lib/opryn/mcp/service": { logMcpActivity: async () => {} },
  "@/lib/opryn/mcp/learning": {
    startExternalLearning: async (_, ctx, input) => {
      assert.equal(ctx.organizationId, "org-a");
      assert.equal(input.context.includes("refund"), true);
      submitted++;
      return { id: "job-a", status: "received", duplicate: submitted > 1 };
    },
    processExternalLearningJob: async () => {},
  },
};
const bundle = await build({
  entryPoints: ["lib/opryn/mcp/tools.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "services",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (a) =>
          ["@/lib/billing/plans", "@/lib/opryn/knowledge/scope"].includes(a.path)
            ? undefined
            : { path: a.path, namespace: "double" },
        );
        b.onResolve({ filter: /^next\/server$/ }, () => ({
          path: "next",
          namespace: "double",
        }));
        b.onLoad({ filter: /.*/, namespace: "double" }, (a) => ({
          contents:
            a.path === "next"
              ? "exports.after = cb => globalThis.__scheduleLearning(cb);"
              : `module.exports = globalThis.__premiumLearningMocks[${JSON.stringify(a.path)}] || {};`,
          loader: "js",
        }));
      },
    },
  ],
});
globalThis.__scheduleLearning = (cb) => scheduled.push(cb);
const fixtureModule = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  (name) => (name === "server-only" ? {} : require(name)),
  fixtureModule,
  fixtureModule.exports,
);
const server = new McpServer({ name: "Opryn test", version: "1.1" });
fixtureModule.exports.registerOprynTools(
  server,
  {
    rpc: async (name) => ({
      data: name === "consume_ai_learning_rate_limit" ? workspaceAllowed : true,
      error: null,
    }),
  },
  auth,
);
const client = new Client({ name: "verification", version: "1" });
const [a, b] = InMemoryTransport.createLinkedPair();
await server.connect(a);
await client.connect(b);
try {
  const list = await client.listTools();
  const tool = list.tools.find((t) => t.name === "learn_from_context");
  assert.ok(tool);
  assert.equal(tool.annotations.readOnlyHint, false);
  assert.ok(tool.inputSchema.properties.learning_request_id);
  const args = {
    name: "Refunds",
    learning_type: "business",
    context:
      "Managers can approve a refund up to $500. Owner approval is required above $500.",
    provider: "claude",
  };
  let result = await client.callTool({ name: tool.name, arguments: args });
  assert.equal(result.structuredContent.error, "premium_required");
  assert.equal(submitted, 0);
  for (const name of ["create_process", "create_process_from_context"]) {
    const legacy = await client.callTool({ name, arguments: { name: "Refunds", context: args.context } });
    assert.equal(legacy.isError, true);
    assert.equal(submitted, 0);
  }
  plan = "premium";
  result = await client.callTool({ name: tool.name, arguments: args });
  assert.equal(result.structuredContent.learningJobId, "job-a");
  assert.equal(scheduled.length, 1);
  assert.equal(result.structuredContent.status, "received");
  result = await client.callTool({
    name: tool.name,
    arguments: { ...args, provider: "chatgpt" },
  });
  assert.equal(result.isError, true);
  result = await client.callTool({
    name: tool.name,
    arguments: {
      ...args,
      learning_request_id: "10000000-0000-4000-8000-000000000001",
    },
  });
  assert.equal(result.isError, true);
  auth.scopes.clear();
  result = await client.callTool({ name: tool.name, arguments: args });
  assert.equal(result.structuredContent.error, "insufficient_scope");
  auth.scopes.add("opryn.learning.create");
  workspaceAllowed = false;
  result = await client.callTool({ name: tool.name, arguments: args });
  assert.equal(result.structuredContent.error, "rate_limited");
  assert.equal(submitted, 1);
  console.log(
    "PASS real MCP discovery/call transport: write tool schema; Premium denial; Premium receipt/background scheduling; scope; mismatched provider; expired/wrong request; workspace rate limit (service doubles)",
  );
} finally {
  await client.close();
  await server.close();
  delete globalThis.__premiumLearningMocks;
  delete globalThis.__scheduleLearning;
}
