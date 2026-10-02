import assert from "node:assert/strict";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
const bundle = await build({
  stdin: {
    contents:
      "export * from './lib/training/model';export * from './lib/training/drafts';",
    loader: "ts",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const {
  knowledgeReadiness,
  agentReadiness,
  classifyEvaluation,
  suggestedPractice,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const knowledge = {
  id: "k",
  content: "Refunds over $500 require manager approval.",
  current_version: 1,
  approved: true,
  library_category: "policy",
  health_status: "healthy",
  library_archived_at: null,
};
const a = {
  required_version: 1,
  acknowledged_version: null,
  passed_version: null,
  update_required: false,
  started_at: null,
};
const s = { status: "approved", knowledge_version: 1, format: "scenario" };
assert.equal(knowledgeReadiness(a, knowledge, s), "Not Started");
assert.equal(
  knowledgeReadiness({ ...a, started_at: "today" }, knowledge, s),
  "Learning",
);
assert.equal(
  knowledgeReadiness({ ...a, acknowledged_version: 1 }, knowledge, s),
  "Practice Needed",
);
assert.equal(
  knowledgeReadiness(
    { ...a, acknowledged_version: 1, passed_version: 1 },
    knowledge,
    s,
  ),
  "Ready",
);
assert.equal(
  knowledgeReadiness(
    { ...a, acknowledged_version: 1, passed_version: 1, update_required: true },
    { ...knowledge, current_version: 2 },
    s,
  ),
  "Update Required",
);
assert.equal(
  knowledgeReadiness(
    { ...a, acknowledged_version: 1, passed_version: 1 },
    knowledge,
    s,
    false,
  ),
  "Blocked",
);
assert.equal(
  knowledgeReadiness({ ...a, acknowledged_version: 1 }, knowledge, {
    ...s,
    format: "acknowledgement",
  }),
  "Ready",
);
assert.equal(
  knowledgeReadiness({ ...a, acknowledged_version: 1 }, knowledge),
  "Blocked",
);
assert.equal(agentReadiness(true, []), "Not Tested");
assert.equal(agentReadiness(false, []), "Blocked");
assert.equal(agentReadiness(true, [{ needs_rerun: true }]), "Update Required");
assert.equal(
  agentReadiness(true, [
    { needs_rerun: false, last_result: { trainingStatus: "passed" } },
  ]),
  "Ready",
);
assert.equal(
  agentReadiness(true, [
    { needs_rerun: false, last_result: { comparison: { passed: true } } },
  ]),
  "Needs Attention",
  "source match alone is not behavior readiness",
);
assert.equal(classifyEvaluation("unknown", false), "knowledge_gap");
assert.equal(classifyEvaluation("answered", false), "failed");
assert.equal(classifyEvaluation("answered", true, false), "review");
assert.equal(classifyEvaluation("answered", true, true), "passed");
assert.equal(classifyEvaluation("restricted", false), "review");
const draft = suggestedPractice(knowledge);
assert.equal(draft.quote, knowledge.content);
assert.match(draft.prompt, /Hypothetical.*\$750/);
assert.equal(
  suggestedPractice({ ...knowledge, library_category: "process" }).format,
  "step_order",
);
console.log(
  "PASS: readiness requires current-version acknowledgement and successful practice; permissions fail closed; missing knowledge differs from failed response; source match alone does not imply passing; generated draft uses a hypothetical scenario and exact approved quote.",
);

assert.equal(
  agentReadiness(true, [
    {
      needs_rerun: false,
      agent_response_required: true,
      last_result: { trainingStatus: "passed" },
      last_agent_result: { trainingStatus: "failed" },
    },
  ]),
  "Needs Attention",
);
assert.equal(
  agentReadiness(true, [
    {
      needs_rerun: false,
      agent_response_required: true,
      agent_response_needs_update: true,
      last_agent_result: { trainingStatus: "passed" },
    },
  ]),
  "Update Required",
);
