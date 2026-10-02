import assert from "node:assert/strict";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
import { writeFile, unlink } from "node:fs/promises";
const b = await build({
  stdin: {
    contents:
      "export {evaluateAgentAnswer} from './lib/training/answer-evaluation';export {submittedAgentResult} from './lib/training/submitted-response';export {evaluationDeadline} from './lib/training/evaluations';",
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "boundaries",
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(server-only|@\/lib\/(ai\/(openai|config)|external-ai\/service|billing\/(subscription|plans)|opryn\/knowledge\/(impact|trust|testbench)))$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        build.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "js",
          contents:
            a.path === "server-only"
              ? ""
              : a.path.endsWith("/openai")
                ? "export const getOpenAI=()=>({responses:{parse:async()=>({output_parsed:globalThis.review})}});"
                : a.path.endsWith("/config")
                  ? 'export const OPENAI_MODELS={text:"fixture"};export const OPENAI_TEXT_REASONING={effort:"low"};'
                  : a.path.endsWith("/service")
                    ? "export const searchExternalKnowledgeWithEmbedding=async()=>({knowledge:globalThis.knowledge});"
                    : a.path.endsWith("/subscription")
                      ? 'export const getOrganizationPlan=async()=>({plan:"core"});'
                      : a.path.endsWith("/plans")
                        ? "export const hasFeature=()=>true;"
                        : a.path.endsWith("/impact")
                          ? "export const connectionPermitsKnowledge=k=>k.approved && globalThis.permitted;"
                          : a.path.endsWith("/trust")
                            ? "export const trustedAnswerContext=async(db,org,rows)=>globalThis.trusted?rows:[];"
                            : 'export const compareTestExpectation=()=>({passed:false});export const testCompanyAnswer=async()=>({type:globalThis.coverage,explanation:"Approved guidance coverage",missingContext:[]});',
        }));
      },
    },
  ],
});
const file = new URL("../.training-agent-verification.mjs", import.meta.url);
await writeFile(file, b.outputFiles[0].text);
try {
  const { evaluateAgentAnswer, submittedAgentResult, evaluationDeadline } =
    await import(file.href);
  assert.equal(
    await evaluationDeadline(async () => "complete", 100),
    "complete",
  );
  await assert.rejects(
    evaluationDeadline(() => new Promise(() => {}), 5),
    /evaluation_timed_out/,
  );
  const guidance = "Refunds over $500 require manager approval.";
  globalThis.review = {
    status: "passed",
    failureCategory: "none",
    reason: "Approval is required.",
    supportingQuote: guidance,
  };
  assert.equal(
    (
      await evaluateAgentAnswer({
        guidance,
        question: "Can I refund $750?",
        response: "Ask a manager to approve.",
        expectedBehavior: "Requires manager approval.",
      })
    ).status,
    "passed",
  );
  globalThis.review = {
    ...globalThis.review,
    supportingQuote: "Refunds up to $900 are always allowed.",
  };
  assert.equal(
    (
      await evaluateAgentAnswer({
        guidance,
        question: "Can I refund $750?",
        response: "Yes.",
        expectedBehavior: "Requires manager approval.",
      })
    ).status,
    "review",
    "unsupported evaluator excerpt cannot pass",
  );
  globalThis.review = {
    status: "failed",
    failureCategory: "hallucinated_policy",
    reason: "The response invents an exception.",
    supportingQuote: guidance,
  };
  assert.equal(
    (
      await evaluateAgentAnswer({
        guidance,
        question: "Can I refund $750?",
        response: "No approval needed for VIPs.",
        expectedBehavior: "Requires manager approval.",
      })
    ).failureCategory,
    "hallucinated_policy",
  );
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const k = id(1),
    org = id(2),
    conn = id(3),
    key = id(4);
  const log = [];
  let keyActive = true,
    optedIn = true;
  globalThis.permitted = true;
  globalThis.trusted = true;
  globalThis.coverage = "answered";
  globalThis.knowledge = [{ id: k, content: guidance, source_type: "rule" }];
  const db = {
    from(table) {
      let columns = "",
        filters = [];
      const query = {
        select(value) {
          columns = value;
          return query;
        },
        eq(field, value) {
          filters.push([field, value]);
          return query;
        },
        is(field, value) {
          filters.push([field, value]);
          return query;
        },
        in(field, value) {
          filters.push([field, value]);
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          return query;
        },
        then(resolve, reject) {
          log.push({ table, columns, filters });
          let data;
          if (table === "external_ai_connections")
            data = {
              id: conn,
              status: "active",
              knowledge_mode: "all_approved",
              knowledge_policy: {},
            };
          else if (table === "external_ai_scopes")
            data = [
              { scope: "knowledge:read" },
              ...(optedIn ? [{ scope: "evaluations:create" }] : []),
            ];
          else if (table === "external_ai_knowledge_access") data = [];
          else if (table === "external_ai_api_keys")
            data = keyActive ? { id: key } : null;
          else if (table === "knowledge_chunks")
            data = columns.includes("content")
              ? [{ id: k, content: guidance, source_type: "rule" }]
              : [{ id: k, approved: true, current_version: 1 }];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const run = {
    organization_id: org,
    connection_id: conn,
    origin_api_key_id: key,
    submitted_response: {
      answer: "Ask a manager to approve.",
      sources: [{ id: k, version: 1 }],
    },
  };
  const test = { question: "Can I refund $750?", context: {} };
  assert.equal((await submittedAgentResult(db, run, test)).type, "answered");
  assert.ok(
    log.every((q) =>
      q.filters.some(
        ([field, value]) => field === "organization_id" && value === org,
      ),
    ),
    "every query is tenant scoped",
  );
  log.length = 0;
  globalThis.permitted = false;
  assert.equal(
    (await submittedAgentResult(db, run, test)).deterministicFailure,
    "used_restricted_knowledge",
  );
  assert.ok(
    !log.some(
      (q) => q.table === "knowledge_chunks" && q.columns.includes("content"),
    ),
    "restricted citation body never read",
  );
  globalThis.permitted = true;
  assert.equal(
    (
      await submittedAgentResult(
        db,
        {
          ...run,
          submitted_response: {
            ...run.submitted_response,
            sources: [{ id: k, version: 2 }],
          },
        },
        test,
      )
    ).deterministicFailure,
    "outdated_guidance",
  );
  globalThis.coverage = "unknown";
  assert.equal(
    (
      await submittedAgentResult(db, run, {
        ...test,
        question: "What about after 45 days?",
      })
    ).type,
    "unknown",
    "a retrieved refund policy does not invent time-window guidance",
  );
  globalThis.coverage = "answered";
  keyActive = false;
  log.length = 0;
  assert.equal((await submittedAgentResult(db, run, test)).type, "restricted");
  assert.ok(
    !log.some((q) => q.table === "knowledge_chunks"),
    "revoked key stops before knowledge retrieval",
  );
  keyActive = true;
  optedIn = false;
  assert.equal((await submittedAgentResult(db, run, test)).type, "restricted");
  console.log(
    "PASS: observable answer evaluation, unsupported excerpt rejection, invented policy failure, tenant filters, permission-before-content, version failure, coverage gaps, revoked key and opt-in scope. Model/provider boundaries are mocked.",
  );
} finally {
  await unlink(file);
}
