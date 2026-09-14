import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function load(relative, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL(relative, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    Date,
    URL,
    Set,
    Map,
    require(name) {
      if (name === "server-only") return {};
      if (dependencies[name]) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const model = load("../lib/opryn/knowledge/health-model.ts");
const { freshnessReason, rankKnowledgeGaps, answeringMustWait } = model;
const now = Date.parse("2026-09-08T12:00:00Z");
const ago = (days) => new Date(now - days * 86400000).toISOString();
const knowledge = {
  approved: true,
  criticality: "normal",
  health_status: "healthy",
  last_confirmed_at: ago(100),
  created_at: ago(300),
  source_modified_at: null,
};
assert.equal(freshnessReason(knowledge, now), null);
assert.match(
  freshnessReason({ ...knowledge, criticality: "critical" }, now),
  /90 days/,
);
assert.match(
  freshnessReason({ ...knowledge, last_confirmed_at: ago(180) }, now),
  /180 days/,
);
assert.equal(freshnessReason({ ...knowledge, approved: false }, now), null);
assert.equal(
  freshnessReason({ ...knowledge, health_status: "conflict" }, now),
  null,
);
assert.match(
  freshnessReason({ ...knowledge, source_modified_at: ago(1) }, now),
  /Source changed/,
);
assert.match(
  freshnessReason({ ...knowledge, last_confirmed_at: null }, now),
  /No confirmation/,
);
assert.equal(
  answeringMustWait([{ approved: true, health_status: "healthy" }], 1),
  false,
);
for (const row of [
  { approved: false, health_status: "healthy" },
  { approved: true, health_status: "conflict" },
  { approved: true, health_status: "needs_review" },
])
  assert.equal(answeringMustWait([row], 1), true);
assert.equal(answeringMustWait([], 1), true);
const clusters = ["refunds", "scheduling", "resolved"].map((id) => ({
  id,
  topic: id,
  representative_question: `Ask about ${id}`,
  status: id === "resolved" ? "resolved" : "open",
}));
const question = (id, cluster, options = {}) => ({
  id,
  cluster_id: cluster,
  asked_by: "sarah",
  origin: "slack",
  created_at: ago(1),
  status: "needs_owner",
  escalated: false,
  ...options,
});
const ranked = rankKnowledgeGaps(
  clusters,
  [
    question("1", "refunds", { escalated: true }),
    question("2", "refunds", {
      asked_by: "emma",
      origin: "mcp_claude",
      escalated: true,
    }),
    question("3", "scheduling"),
    question("4", "resolved"),
    question("5", "scheduling", { created_at: ago(31), escalated: true }),
  ],
  3,
  now,
);
assert.equal(ranked[0].id, "refunds");
assert.equal(ranked[0].estimatedMinutes, 6);
assert.equal(ranked[0].people, 2);
assert.equal(ranked[0].channels.mcp_claude, 1);
assert.equal(
  ranked[1].estimatedMinutes,
  0,
  "Unknown is not automatically an owner interruption",
);
assert.equal(ranked.length, 2);
assert.equal(
  rankKnowledgeGaps(
    clusters,
    [question("1", "refunds", { status: "answered" })],
    3,
    now,
  ).length,
  0,
);

const { trustedAnswerContext, assertNoBlockingKnowledgeConflict } = load(
  "../lib/opryn/knowledge/trust.ts",
  {
    "./health-model": model,
  },
);
let blocked = false;
let rpcError = null;
const calls = [];
const service = {
  from(table) {
    assert.equal(table, "knowledge_chunks");
    const chain = {
      select() {
        return chain;
      },
      eq(field, value) {
        calls.push([field, value]);
        return chain;
      },
      in() {
        return Promise.resolve({
          data: [{ id: "k", approved: true, health_status: "healthy" }],
          error: null,
        });
      },
    };
    return chain;
  },
  async rpc(name, args) {
    assert.equal(name, "knowledge_context_requires_review");
    assert.equal(args.target_organization_id, "org-a");
    return { data: blocked, error: rpcError };
  },
};
const sources = [{ id: "k", content: "Approved policy" }];
await assert.rejects(
  () =>
    assertNoBlockingKnowledgeConflict(service, "org-a", [
      { id: "k", health_status: "conflict" },
    ]),
  /Resolve the knowledge conflict/,
);
assert.equal((await trustedAnswerContext(service, "org-a", sources)).length, 1);
blocked = true;
assert.equal(
  (await trustedAnswerContext(service, "org-a", sources)).length,
  0,
  "Conflict never falls back to a partial answer",
);
rpcError = new Error("Database unavailable");
await assert.rejects(
  () => trustedAnswerContext(service, "org-a", sources),
  /Database unavailable/,
);
assert.ok(
  calls.every(
    ([field, value]) => field === "organization_id" && value === "org-a",
  ),
);
for (const path of [
  "../app/api/ask/route.ts",
  "../lib/communication/answer.ts",
  "../lib/external-ai/service.ts",
  "../lib/opryn/knowledge/retrieval.ts",
])
  assert.match(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    /await trustedAnswerContext\(/,
    `${path} must use the same trust gate`,
  );
console.log(
  "Passed freshness boundaries, observed/conflict safety, real interruption ranking, source-channel counts, organization-scoped trust gate, and failure-closed retrieval.",
);

// Exercise the real review API with authenticated/failing contexts, without DB writes.
let allowed = true;
let resultError = null;
let rpcCalls = 0;
const orgId = "00000000-0000-4000-8000-000000000001";
const knowledgeId = "00000000-0000-4000-8000-000000000002";
const json = (body, options = {}) =>
  new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: options.headers,
  });
const route = load("../app/api/learning-inbox/route.ts", {
  zod: { z },
  "next/server": { NextResponse: { json } },
  "@/lib/api": {
    getRequestContext: async () =>
      allowed
        ? {
            membership: { organization_id: orgId },
            user: { id: "owner" },
            supabase: {
              rpc: async (name, args) => {
                rpcCalls++;
                assert.equal(name, "confirm_company_knowledge");
                assert.equal(args.target_organization_id, orgId);
                assert.equal(args.expected_version, 2);
                return { data: null, error: resultError };
              },
            },
          }
        : { error: json({ error: "Forbidden" }, { status: 403 }) },
    apiError: () => json({ error: "Not saved" }, { status: 500 }),
  },
});
const request = (body, origin = "https://www.opryn.app") =>
  new Request("https://www.opryn.app/api/learning-inbox", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const action = { action: "confirm_knowledge", knowledgeId, version: 2 };
assert.equal(
  (await route.POST(request(action, "https://unrelated.example"))).status,
  403,
);
allowed = false;
assert.equal((await route.POST(request(action))).status, 403);
allowed = true;
assert.equal(
  (await route.POST(request({ ...action, version: undefined }))).status,
  400,
);
assert.equal(rpcCalls, 0);
assert.equal(
  (
    await route.POST(
      request({ ...action, organization_id: "client-cannot-select-org" }),
    )
  ).status,
  200,
);
resultError = { code: "40001" };
assert.equal((await route.POST(request(action))).status, 409);
resultError = { code: "53300" };
assert.equal((await route.POST(request(action))).status, 429);
console.log(
  "Passed real review API CSRF, admin authorization, server-selected organization, required version, stale review, and rate-limit responses.",
);
