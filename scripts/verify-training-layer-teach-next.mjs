import assert from "node:assert/strict";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
const bundled = await build({
  entryPoints: ["lib/training/teach-next.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "server-only",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({
          path: "server-only",
          namespace: "fixture",
        }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: "",
          loader: "js",
        }));
      },
    },
  ],
});
const { trainingTeachNext } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundled.outputFiles[0].text).toString("base64")
);
const org = "workspace";
let rows = {
  knowledge_test_cases: [
    {
      title: "Cancellation exceptions",
      question: "Can I cancel late?",
      connection_id: "agent1",
      agent_response_required: true,
      last_agent_result: { trainingStatus: "knowledge_gap" },
      last_result: { trainingStatus: "passed" },
    },
    {
      title: "Cancellation exceptions",
      question: "Can I cancel late?",
      connection_id: "agent2",
      last_result: { trainingStatus: "knowledge_gap" },
    },
  ],
  knowledge_feedback: [],
  employee_questions: [
    { question: "Can I cancel late?", asked_by: "employee1" },
    { question: "Can I cancel late?", asked_by: "employee1" },
    { question: "Can I cancel late?", asked_by: "employee2" },
  ],
};
const db = {
  from(table) {
    let tenant;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        if (k === "organization_id") tenant = v;
        return q;
      },
      is() {
        return q;
      },
      not() {
        return q;
      },
      or() {
        return q;
      },
      limit() {
        return q;
      },
      gte() {
        return q;
      },
      in() {
        return q;
      },
      then(resolve, reject) {
        assert.equal(tenant, org);
        return Promise.resolve({ data: rows[table], error: null }).then(
          resolve,
          reject,
        );
      },
    };
    return q;
  },
};
let signal = await trainingTeachNext(db, org);
assert.match(signal.reason, /2 agents/);
assert.match(signal.reason, /2 employees/);
assert.equal(signal.question, "Can I cancel late?");
rows.knowledge_test_cases = [];
rows.knowledge_feedback = [
  { knowledge_chunk_id: "policy", reason: "unclear" },
  { knowledge_chunk_id: "policy", reason: "outdated" },
];
signal = await trainingTeachNext(db, org);
assert.match(signal.reason, /2 open training reports/);
assert.equal(signal.href, "/app/knowledge/policy/history");
rows.knowledge_feedback = [];
assert.equal(await trainingTeachNext(db, org), null);
console.log(
  "PASS: shared Teach Next signals, external gap retention, distinct employees, tenant scoping and training feedback review. Database boundary mocked.",
);
