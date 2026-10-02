// Real testbench, trust and scope services; provider and database responses are fixtures.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  entryPoints: ["lib/opryn/knowledge/testbench.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "isolated-model",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(server-only|@\/lib\/ai\/services|@\/lib\/billing\/subscription)$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "server-only"
              ? ""
              : a.path.includes("subscription")
                ? "export const getOrganizationPlan=async()=>({plan:globalThis.fixture.plan});"
                : `export const embedKnowledge=async()=>[[1]];export const answerCompanyQuestion=async()=>{const s=globalThis.fixture;s.calls++;if(s.race)s.version++;if(s.roleRace)s.role='Employee';if(s.accessRace)s.restricted=true;return s.answer;};`,
          loader: "js",
        }));
      },
    },
  ],
});
const { testCompanyAnswer, compareTestExpectation } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
let s;
const reset = () =>
  (globalThis.fixture = s =
    {
      scope: {},
      role: "Manager",
      version: 3,
      calls: 0,
      plan: "premium",
      active: true,
      scopes: ["knowledge:read", "policies:read"],
      answer: {
        can_answer: true,
        confidence: 0.94,
        answer: "Owner approval above $500.",
        steps: [],
        important_note: "",
        cited_source_ids: ["chunk"],
      },
    });
const candidate = {
  id: "chunk",
  content: "Refund limits: Owner approval above $500.",
  source_type: "rule",
  similarity: 0.95,
};
const service = {
  from(table) {
    const filters = [];
    let fields;
    const chain = {
      select(f) {
        fields = f;
        return chain;
      },
      eq(...f) {
        filters.push(f);
        return chain;
      },
      in() {
        return chain;
      },
      limit() {
        return chain;
      },
      maybeSingle() {
        return chain;
      },
      then(resolve) {
        assert.ok(
          filters.some(([k, v]) => k === "organization_id" && v === "org"),
          "All reads tenant-scoped",
        );
        let data;
        if (table === "organization_settings")
          data = { employees_can_ask: !s.disabled, confidence_threshold: 0.72 };
        if (table === "organization_members")
          data = s.noMember ? null : { user_id: "member", role_id: "role" };
        if (table === "roles") data = { name: s.role };
        if (table === "knowledge_chunks")
          data = [
            {
              id: "chunk",
              scope: s.scope,
              approved: true,
              health_status: s.conflict ? "conflict" : "healthy",
              current_version: s.version,
              criticality: s.critical ? "critical" : "normal",
            },
          ];
        if (table === "knowledge_conflicts")
          data = s.conflict ? [{ id: "conflict" }] : [];
        if (table === "external_ai_connections")
          data = {
            status: s.active ? "active" : "revoked",
            name: "Support bot",
          };
        if (table === "external_ai_scopes")
          data = s.scopes.map((scope) => ({ scope }));
        assert.ok(data !== undefined, `Unhandled ${table}/${fields}`);
        resolve({ data, error: null });
      },
    };
    return chain;
  },
  async rpc(name) {
    if (name === "knowledge_context_requires_review")
      return { data: !!s.conflict, error: null };
    assert.ok(
      [
        "match_knowledge_for_communication",
        "match_external_ai_knowledge",
      ].includes(name),
    );
    return { data: s.restricted ? [] : [candidate], error: null };
  },
};
const run = (context = {}, consumer = "employee") =>
  testCompanyAnswer(service, "org", {
    question: "Can I refund $700?",
    context,
    consumer,
    actorId: consumer === "employee" ? "member" : undefined,
    connectionId: consumer === "employee" ? undefined : "connection",
  });
reset();
let result = await run();
assert.equal(result.type, "answered");
assert.equal(result.sources[0].version, 3);
assert.equal(result.question, "Can I refund $700?");
assert.equal(
  compareTestExpectation(result, "answered", ["chunk"]).passed,
  true,
);
assert.equal(
  compareTestExpectation(result, "answered", ["foreign"]).passed,
  false,
);
reset();
s.scope = { regions: ["US"] };
assert.equal((await run()).type, "needs_clarification");
assert.equal(s.calls, 0);
assert.equal((await run({ regions: ["EU"] })).type, "unknown");
assert.equal(s.calls, 0);
assert.equal((await run({ regions: ["US"] })).type, "answered");
reset();
s.scope = { roles: ["Manager"] };
assert.equal((await run({ roles: ["Admin"] })).type, "answered");
s.role = "Employee";
assert.equal((await run({ roles: ["Manager"] })).type, "unknown");
for (const change of [
  () => (s.disabled = true),
  () => (s.noMember = true),
  () => (s.restricted = true),
  () => (s.conflict = true),
  () => (s.scope = { effectiveUntil: "2000-01-01" }),
  () => {
    s.critical = true;
    s.answer.confidence = 0.89;
  },
  () => (s.answer.cited_source_ids = ["fabricated"]),
]) {
  reset();
  change();
  assert.notEqual((await run()).type, "answered");
}
for (const flag of ["race", "roleRace", "accessRace"]) {
  reset();
  s[flag] = true;
  result = await run();
  assert.notEqual(result.type, "answered");
  assert.equal(result.answer, null);
}
reset();
assert.equal((await run({}, "support_bot")).type, "answered");
for (const change of [
  () => (s.active = false),
  () => (s.plan = "core"),
  () => (s.scopes = []),
]) {
  reset();
  change();
  assert.equal((await run({}, "connected_ai")).type, "restricted");
  assert.equal(s.calls, 0);
}
console.log(
  "PASS: real testbench/trust/scope services; source-backed answers/version, missing/mismatched/date scope, actual role override, restrictions, conflicts, critical confidence, fabricated citations, model-time version/role/access races, external entitlements and deterministic expectations. No write/send/event methods exist in fixture.",
);
