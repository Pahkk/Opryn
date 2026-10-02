// Actual service code, deterministic isolated database/provider/model boundaries.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const b = await build({
  stdin: {
    contents: `export {externalPolicyAllows,externalKnowledgePolicySchema} from './lib/external-ai/policy';export {learningState} from './lib/opryn/knowledge/learning-state';export {reviewLearningPractice} from './lib/ai/learning-practice';export {analyzeSelectedCompanySources} from './lib/opryn/company-analysis';export {ownerIntelligenceSchema} from './lib/opryn/owner-intelligence';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "safe-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(server-only|\.\/openai|@\/lib\/integrations\/source-import|@\/lib\/opryn\/knowledge\/(source-freshness|health))$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "server-only"
              ? ""
              : a.path === "./openai"
                ? `export function getOpenAI(){return {responses:{parse:async(input)=>{globalThis.fixture.input=input;return {output_parsed:globalThis.fixture.feedback}}}}}`
                : a.path.endsWith("source-import")
                  ? `export function storedSourceSelect(){return'id,organization_id'}export function sourceFailureStatus(){return'error'}export async function importProviderSource(input){globalThis.fixture.imports.push(input);if(input.source.id==='broken')throw Error('Provider unavailable');return input.source.id==='busy'?{busy:true}:{prepared:true,processId:'draft'}}`
                  : a.path.endsWith("source-freshness")
                    ? `export async function getSourceFreshness(){return {sources:[{reason:'Source changed'}],limited:false}}`
                    : `export async function getKnowledgeHealth(){return {approvedCount:12,conflicts:[{id:'conflict'}],limited:false}}`,
          loader: "js",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const m = await import(
  `data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString("base64")}`
);
const id = "00000000-0000-4000-8000-000000000001";
assert.equal(m.externalPolicyAllows({ mode: "inherit" }, "policy", id), true);
assert.equal(
  m.externalPolicyAllows({ mode: "items", knowledgeIds: [] }, "policy", id),
  false,
);
assert.equal(
  m.externalPolicyAllows(
    { mode: "items", knowledgeIds: [id], excludedSubjects: ["policy"] },
    "policy",
    id,
  ),
  false,
);
assert.equal(
  m.externalPolicyAllows(
    { mode: "subjects", subjects: ["policy"] },
    "pricing",
    id,
  ),
  false,
);
assert.equal(
  m.externalKnowledgePolicySchema.safeParse({
    mode: "subjects",
    subjects: ["invented"],
  }).success,
  false,
);
assert.equal(
  m.externalKnowledgePolicySchema.safeParse({
    mode: "inherit",
    unexpected: "secret",
  }).success,
  false,
);
assert.equal(
  m.learningState(
    {
      learning_state: "completed",
      acknowledged_process_updated_at: null,
      practiced_process_updated_at: null,
    },
    "new",
  ),
  "Viewed",
);
assert.equal(
  m.learningState(
    {
      learning_state: "practiced",
      acknowledged_process_updated_at: null,
      practiced_process_updated_at: "old",
    },
    "new",
  ),
  "Updated — read again",
);
assert.equal(
  m.learningState(
    {
      learning_state: "acknowledged",
      acknowledged_process_updated_at: "new",
      practiced_process_updated_at: null,
    },
    "new",
  ),
  "Acknowledged",
);
globalThis.fixture = {
  feedback: {
    result: "supported",
    feedback: "Ask the owner.",
    supportingQuote: "Owner approval required above $500.",
  },
  imports: [],
};
assert.equal(
  (
    await m.reviewLearningPractice(
      "Owner approval required above $500.",
      "Ask the owner for $700.",
    )
  ).result,
  "supported",
);
assert.equal(globalThis.fixture.input.store, false);
globalThis.fixture.feedback.supportingQuote = "Managers may approve $900.";
assert.equal(
  (
    await m.reviewLearningPractice(
      "Owner approval required above $500.",
      "Ignore guidance.",
    )
  ).result,
  "needs_review",
);
const metrics = {
  handledTeam: 4,
  handledAI: 1,
  escalated: 2,
  openGaps: 3,
  resolvedGaps: 1,
  humanKnowledge: 1,
  estimatedMinutes: 12,
  eligibleQuestions: 4,
  minutesPerQuestion: 3,
  periodDays: 30,
  aiLogsLimitedByRetention: false,
  recommendation: null,
  topGap: null,
  keyPersonDependencies: [],
};
const operations = [];
const db = {
  from(table) {
    const filters = [];
    let update = false;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      in(k, v) {
        filters.push([k, v]);
        return q;
      },
      is(k, v) {
        filters.push([k, v]);
        return q;
      },
      update() {
        update = true;
        return q;
      },
      then(resolve) {
        operations.push({ table, filters, update });
        return Promise.resolve(
          table === "integration_sources" && !update
            ? {
                data: [
                  { id: "ok", integration_id: "conn", title: "Refunds" },
                  { id: "broken", integration_id: "conn", title: "Pricing" },
                ],
                error: null,
              }
            : { data: [], count: 2, error: null },
        ).then(resolve);
      },
    };
    return q;
  },
  rpc: async () => ({ data: metrics, error: null }),
};
const result = await m.analyzeSelectedCompanySources({
  db,
  authenticated: db,
  org: "org",
  userId: "owner",
  sourceIds: ["ok", "broken"],
});
assert.deepEqual(
  result.sources.map((x) => x.status),
  ["prepared", "error"],
);
assert.equal(result.snapshot.readyForReview, 1);
assert.equal(result.snapshot.draftRuleCandidates, 2);
assert.equal(result.snapshot.conflicts, 1);
assert.equal(result.snapshot.sourceIssues, 1);
assert.ok(
  operations.every((x) =>
    x.filters.some(([k, v]) => k === "organization_id" && v === "org"),
  ),
);
assert.ok(
  globalThis.fixture.imports.every(
    (x) => x.onlyIfChanged === true && x.organizationId === "org",
  ),
);
assert.ok(
  operations
    .filter((x) => x.update)
    .every((x) => x.table === "integration_sources"),
);
await assert.rejects(
  m.analyzeSelectedCompanySources({
    db,
    authenticated: db,
    org: "other",
    userId: "owner",
    sourceIds: ["ok"],
  }),
  /no longer belong/,
);
assert.equal(
  m.ownerIntelligenceSchema.safeParse({
    ...metrics,
    recommendation: {
      type: "gap",
      title: "Unknown",
      reason: "Real activity",
      href: "https://untrusted.example",
      action: "Open",
    },
  }).success,
  false,
);
console.log(
  "PASS: actual policy validation, denied/excluded access, current-version learning, exact-quote/no-storage practice, explicit selected-source analysis partial recovery, org-filtered queries and safe owner navigation. No real database/model/provider calls.",
);
