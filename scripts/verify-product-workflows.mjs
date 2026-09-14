import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function load(path, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      URL,
      Request,
      Response,
      Set,
      Map,
      Date,
      console,
      require: (name) =>
        dependencies[name] ??
        (() => {
          throw new Error(`Unexpected dependency ${name}`);
        })(),
    },
  );
  return exports;
}
const { estimateReturnedTime } = load("../lib/answered-work.ts");
const q = {
  id: "1",
  asked_by: "team-member",
  question: "Can I refund $500?",
  origin: "employee",
  status: "answered",
  answered_by_opryn: true,
  escalated: false,
  created_at: "2026-09-08T09:00:00Z",
};
const estimate = estimateReturnedTime(
  [
    q,
    { ...q, id: "duplicate" },
    { ...q, id: "threshold", question: "Can I refund $700?" },
    { ...q, id: "next-day", created_at: "2026-09-09T09:00:00Z" },
    { ...q, id: "owner", asked_by: "owner" },
    { ...q, id: "agent", origin: "mcp_claude" },
    { ...q, id: "escalated", escalated: true },
    { ...q, id: "failed", status: "needs_owner" },
    { ...q, id: "negative", question: "Pricing?" },
    { ...q, id: "no-answer", answered_by_opryn: false },
  ],
  new Set(["team-member"]),
  new Set(["negative"]),
  3,
);
assert.equal(estimate.count, 3);
assert.equal(estimate.minutes, 9);
assert.equal(estimateReturnedTime([q], new Set(), new Set(), 3).minutes, 0);
const { isProductRouteActive } = load("../lib/product-navigation.ts");
assert.equal(
  isProductRouteActive("/app/processes", "/app/processes/new"),
  false,
);
assert.equal(
  isProductRouteActive("/app/processes/new", "/app/processes/new"),
  true,
);
assert.equal(
  isProductRouteActive("/app/integrations", "/app/ai-connections"),
  true,
);
assert.equal(
  isProductRouteActive("/app/processes", "/app/knowledge/health"),
  true,
);

const json = (body, options = {}) =>
  new Response(JSON.stringify(body), { status: options.status ?? 200 });
let authorized = true,
  lastInput,
  calls = 0,
  conflict = false;
class ProposalResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const handlers = load("../app/api/knowledge-proposals/[id]/approve/route.ts", {
  zod: { z },
  "next/server": { NextResponse: { json } },
  "@/lib/api": {
    getRequestContext: async () =>
      authorized
        ? {
            supabase: {},
            membership: { organization_id: "server-selected-org" },
            user: { id: "owner" },
          }
        : { error: json({ error: "Forbidden" }, { status: 403 }) },
    apiError: () => json({ error: "Unavailable" }, { status: 500 }),
  },
  "@/lib/opryn/knowledge/proposals": {
    ProposalResolutionError,
    approveKnowledgeProposal: async (input) => {
      calls++;
      lastInput = input;
      if (conflict)
        throw new ProposalResolutionError(
          "already_resolved",
          "Review the latest revision.",
        );
      return { status: "approved" };
    },
  },
});
const invoke = (body, headers = {}) =>
  handlers.POST(
    new Request("https://opryn.test/api/knowledge-proposals/one/approve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://opryn.test",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "one" }) },
  );
assert.equal((await invoke({})).status, 400);
assert.equal(calls, 0);
const revision = {
  version: 2,
  updatedAt: "2026-09-08T12:00:00Z",
  organization_id: "another-business",
};
assert.equal(
  (await invoke(revision, { origin: "https://untrusted.test" })).status,
  403,
);
assert.equal(calls, 0);
assert.equal((await invoke(revision)).status, 200);
assert.equal(lastInput.organizationId, "server-selected-org");
assert.equal(lastInput.expectedVersion, 2);
assert.equal(lastInput.expectedUpdatedAt, revision.updatedAt);
authorized = false;
assert.equal((await invoke(revision)).status, 403);
assert.equal(calls, 1);
authorized = true;
conflict = true;
assert.equal((await invoke(revision)).status, 409);
console.log(
  "Passed conservative time estimates, threshold-preserving dedupe, task navigation, proposal API CSRF, admin gating, server-selected organization, required revision and stale-response checks. API identity is mocked; transaction behavior is tested separately in PostgreSQL.",
);
