// Actual progress/trust/scope service, deterministic database boundaries. No network.
import assert from "node:assert/strict";
import { build } from "esbuild";
Error.stackTraceLimit = 0;
const result = await build({
  entryPoints: ["lib/opryn/knowledge/question-progress.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "server-marker",
      setup(b) {
        b.onResolve({ filter: /^server-only$/ }, () => ({
          path: "marker",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
const { getQuestionProgress } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
let state;
const reset = () => {
  state = {
    queries: [],
    question: {
      id: "q",
      status: "needs_owner",
      escalated: true,
      scope_context: {},
    },
    settings: { employees_can_ask: true },
    rechecks: [],
    proposals: [],
    answers: [],
    chunks: [
      {
        id: "k",
        content: "Manager approval is required above $500.",
        source_type: "owner_answer",
        source_id: "a",
        process_id: null,
        rule_id: null,
        role_id: null,
        approved: true,
        health_status: "healthy",
        scope: {},
        updated_at: "2026-09-18T10:00:00Z",
      },
    ],
    conflict: false,
  };
};
function client(kind) {
  return {
    from(table) {
      const filters = [];
      const chain = {
        select() {
          return chain;
        },
        eq(...args) {
          filters.push(args);
          return chain;
        },
        in(...args) {
          filters.push(args);
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          return chain;
        },
        then(resolve) {
          state.queries.push({ kind, table, filters });
          if (["process_steps", "process_rules", "processes"].includes(table)) {
            assert.equal(kind, "session", "source titles use session RLS");
            assert.ok(
              filters.some(([k]) => k === "id"),
              "source metadata restricted to authorized citation IDs",
            );
            resolve({ data: [], error: null });
            return;
          }
          assert.ok(
            filters.some(([k, v]) => k === "organization_id" && v === "org"),
            `${table} must be tenant scoped`,
          );
          if (table === "employee_questions") {
            assert.equal(kind, "session");
            assert.ok(
              filters.some(([k, v]) => k === "asked_by" && v === "asker"),
            );
            assert.ok(filters.some(([k, v]) => k === "id" && v === "q"));
          }
          if (table === "knowledge_chunks")
            assert.equal(kind, "session", "content must use session RLS");
          const data = {
            employee_questions: state.question,
            organization_settings: state.settings,
            knowledge_gap_rechecks: state.rechecks,
            knowledge_proposals: state.proposals,
            question_answers: state.answers,
            knowledge_chunks: state.chunks,
            organization_members: { role_id: null },
          }[table];
          assert.notEqual(data, undefined, `Unexpected read ${table}`);
          resolve({
            data,
            error:
              state.failTable === table
                ? new Error("database unavailable")
                : null,
          });
        },
      };
      return chain;
    },
    async rpc(name, args) {
      assert.equal(name, "knowledge_context_requires_review");
      assert.equal(args.target_organization_id, "org");
      return { data: state.conflict, error: null };
    },
  };
}
const progress = () =>
  getQuestionProgress({
    session: client("session"),
    service: client("service"),
    organizationId: "org",
    userId: "asker",
    questionId: "q",
  });
const approve = () => {
  state.proposals = [{ status: "approved" }];
  state.rechecks = [
    {
      status: "answered",
      answer: "Manager approval is required.",
      cited_knowledge_ids: ["k"],
      checked_at: "2026-09-18T11:00:00Z",
    },
  ];
};
let checks = 0;
async function test(name, fn) {
  reset();
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
await test("foreign/missing question stops before service reads", async () => {
  state.question = null;
  assert.equal(await progress(), null);
  assert.equal(state.queries.length, 1);
});
await test("disabled Ask reveals no workflow or answer", async () => {
  state.settings.employees_can_ask = false;
  assert.equal((await progress()).state, "restricted");
  assert.equal(state.queries.length, 2);
});
await test("routed question remains pending", async () =>
  assert.equal((await progress()).state, "routed"));
await test("unrouted question remains unknown", async () => {
  state.question.escalated = false;
  assert.equal((await progress()).state, "unknown");
});
await test("dismissed question is not presented as waiting", async () => {
  state.question.status = "dismissed";
  assert.equal((await progress()).state, "dismissed");
  assert.equal(state.queries.length, 2);
});
await test("undecided human draft is not returned", async () => {
  state.answers = [{ reusable_intent: "undecided", answer: "draft" }];
  assert.equal((await progress()).humanAnswer, undefined);
});
for (const intent of ["answer_only", "one_time_exception"])
  await test(intent, async () => {
    state.answers = [{ reusable_intent: intent, answer: "One time only" }];
    const p = await progress();
    assert.equal(p.state, "one_time");
    assert.equal(p.humanAnswer, "One time only");
    assert.equal(p.answer, undefined);
  });
await test("proposal is not an approved answer", async () => {
  state.proposals = [{ status: "pending_approval" }];
  assert.equal((await progress()).state, "review");
});
await test("denial preserves human authority", async () => {
  state.proposals = [{ status: "rejected" }];
  assert.equal((await progress()).state, "denied");
});
await test("approval without recheck is not success", async () => {
  state.proposals = [{ status: "approved" }];
  assert.equal((await progress()).state, "rechecking");
});
await test("confirmed answer returns source in original question", async () => {
  approve();
  const p = await progress();
  assert.equal(p.state, "approved");
  assert.equal(p.answer, "Manager approval is required.");
  assert.equal(p.sources[0].content, state.chunks[0].content);
});
for (const reason of [
  "access",
  "changed",
  "unapproved",
  "conflict",
  "scope",
  "missing-citation",
  "deleted",
])
  await test(`withhold ${reason}`, async () => {
    approve();
    if (["access", "deleted"].includes(reason)) state.chunks = [];
    if (reason === "changed")
      state.chunks[0].updated_at = "2026-09-18T12:00:00Z";
    if (reason === "unapproved") state.chunks[0].approved = false;
    if (reason === "conflict") state.conflict = true;
    if (reason === "scope") state.chunks[0].scope = { regions: ["EU"] };
    if (reason === "missing-citation")
      state.rechecks[0].cited_knowledge_ids = [];
    const p = await progress();
    assert.equal(p.state, "needs_recheck");
    assert.equal(p.answer, undefined);
    assert.equal(p.sources, undefined);
  });
await test("database error fails closed", async () => {
  state.failTable = "knowledge_proposals";
  await assert.rejects(progress());
});
console.log(
  `${checks} question-progress cases passed. Database/auth boundaries are fixtures, not live E2E.`,
);
