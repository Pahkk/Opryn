// Real service/trust-gate code, deterministic model + permission-query fixtures. No network.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  entryPoints: ["lib/opryn/knowledge/gap-rechecks.ts"],
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
          { filter: /^(server-only|@\/lib\/ai\/services)$/ },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
          contents:
            args.path === "server-only"
              ? ""
              : `export const embedKnowledge=async(query)=>{globalThis.fixture.embedQuery=query;return [[1]]};export const answerCompanyQuestion=async(...args)=>{globalThis.fixture.modelCalls.push(args);if(globalThis.fixture.failModel) throw new Error('private failure');return globalThis.fixture.answer;};`,
          loader: "js",
        }));
      },
    },
  ],
});
const { recheckKnowledgeGapAnswers } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const org = "workspace",
  proposalId = "proposal",
  actor = "original-employee",
  chunk = "approved-rule";
let state;
const reset = () => {
  state = {
    answer: {
      can_answer: true,
      confidence: 0.94,
      answer: "Owner approval above $500.",
      steps: [],
      important_note: "",
      cited_source_ids: [chunk],
    },
    modelCalls: [],
    commits: [],
    queries: [],
    criticality: "normal",
    health: "healthy",
    restricted: false,
  };
  globalThis.fixture = state;
};
const service = {
  from(table) {
    const filters = [];
    const chain = {
      select() {
        return chain;
      },
      eq(...f) {
        filters.push(f);
        return chain;
      },
      in(...f) {
        filters.push(f);
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      single() {
        return chain;
      },
      maybeSingle() {
        return chain;
      },
      then(resolve) {
        state.queries.push({ table, filters });
        assert.ok(
          filters.some(([k, v]) => k === "organization_id" && v === org),
          "every table read is tenant scoped",
        );
        let data;
        if (table === "organization_members") data = {role_id:null};
        if (table === "knowledge_proposals")
          data = { status: "approved", approved_knowledge_id: chunk };
        if (table === "knowledge_gap_rechecks")
          data = [{ question_id: "question" }];
        if (table === "employee_questions")
          data = {
            question: "What about $700?",
            asked_by: actor,
            conversation_context: [
              { role: "user", text: "Refund policy?" },
              { role: "opryn", text: "Managers up to $500." },
            ],
          };
        if (table === "question_attachments")
          data = state.image ? [{ id: "attachment" }] : [];
        if (table === "knowledge_chunks")
          data = [
            {
              id: chunk,
              approved: true,
              health_status: state.health,
              current_version: 3,
              criticality: state.criticality,
            },
          ];
        if (table === "organization_settings")
          data = {
            confidence_threshold: 0.72,
            employees_can_ask: !state.askDisabled,
          };
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return chain;
  },
  async rpc(name, args) {
    assert.equal(args.target_organization_id, org);
    if (name === "claim_knowledge_gap_rechecks")
      return { data: [{ question_id: "question" }], error: null };
    if (name === "match_knowledge_for_communication") {
      assert.equal(
        args.target_user_id,
        actor,
        "never recheck using the approving admin",
      );
      return {
        data: state.restricted
          ? []
          : [
              {
                id: chunk,
                content: "Managers up to $500. Owner approval above.",
                similarity: 0.9,
              },
            ],
        error: null,
      };
    }
    if (name === "knowledge_context_requires_review")
      return { data: state.health !== "healthy", error: null };
    if (name === "complete_knowledge_gap_recheck") {
      state.commits.push(args);
      return { data: args.result_status === "answered", error: null };
    }
    throw new Error(`Unexpected RPC ${name}`);
  },
};
const run = async () => {
  const result = await recheckKnowledgeGapAnswers(service, org, proposalId);
  assert.equal(state.commits.length, 1);
  return result[0].status;
};
reset();
assert.equal(await run(), "answered");
assert.equal(state.commits[0].expected_knowledge_version, 3);
assert.ok(state.embedQuery[0].includes("Refund policy?"));
assert.equal(state.modelCalls[0][3][0].text, "Refund policy?");
reset();
state.restricted = true;
assert.equal(await run(), "unknown");
assert.equal(state.modelCalls.length, 0);
reset();
state.health = "conflict";
assert.equal(await run(), "unknown");
assert.equal(state.modelCalls.length, 0);
reset();
state.answer.cited_source_ids = ["invented-source"];
assert.equal(await run(), "unknown");
reset();
state.criticality = "critical";
state.answer.confidence = 0.85;
assert.equal(await run(), "unknown");
reset();
state.askDisabled = true;
assert.equal(await run(), "unknown");
assert.equal(state.modelCalls.length, 0);
reset();
state.failModel = true;
assert.equal(await run(), "error");
assert.equal(state.commits[0].result_answer, "");
reset();
state.image = true;
assert.equal(await run(), "unknown");
assert.equal(state.modelCalls.length, 0);
console.log(
  "PASS: real recheck service with original-actor retrieval, history, citations, critical confidence, conflict/disabled/restricted/exception safety, image context and model failure",
);
