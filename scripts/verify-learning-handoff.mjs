// Isolated handler and PostgreSQL checks. No provider calls or Supabase writes.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const id = "40000000-0000-4000-8000-000000000001";
let intent = {
  provider: "chatgpt",
  type: "business",
  name: "Acme",
  stage: "waiting",
  requestId: id,
  expiresAt: new Date(Date.now() + 60000).toISOString(),
};
let filters = [];
const service = {
  from(table) {
    assert.equal(table, "onboarding_learning_sessions");
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      update(body) {
        intent = body.intent;
        return q;
      },
      maybeSingle: async () => ({ data: { intent }, error: null }),
      then: (resolve) => Promise.resolve({ error: null }).then(resolve),
    };
    return q;
  },
};
const bundle = await build({
  entryPoints: ["lib/onboarding/learning-handoff.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
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
const fixtureModule = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  require,
  fixtureModule,
  fixtureModule.exports,
);
const { validateLearningHandoff, attachLearningHandoff } =
  fixtureModule.exports;
const auth = {
  organizationId: "org-a",
  userId: "user-a",
  clientKind: "chatgpt",
};
assert.equal(await validateLearningHandoff(service, auth), null);
assert.equal((await validateLearningHandoff(service, auth, id)).name, "Acme");
assert.ok(filters.some(([k, v]) => k === "organization_id" && v === "org-a"));
assert.ok(filters.some(([k, v]) => k === "user_id" && v === "user-a"));
await assert.rejects(
  validateLearningHandoff(service, { ...auth, clientKind: "claude" }, id),
);
await assert.rejects(
  validateLearningHandoff(
    service,
    auth,
    "40000000-0000-4000-8000-000000000002",
  ),
);
const original = { ...intent };
intent = { ...intent, expiresAt: new Date(Date.now() - 1000).toISOString() };
await assert.rejects(validateLearningHandoff(service, auth, id));
intent = original;
await attachLearningHandoff(
  service,
  auth,
  intent,
  "50000000-0000-4000-8000-000000000001",
);
assert.ok(filters.some(([k, v]) => k === "intent->>requestId" && v === id));
await assert.rejects(
  attachLearningHandoff(
    service,
    auth,
    intent,
    "50000000-0000-4000-8000-000000000002",
  ),
);
const { PGlite } = await import(
  process.env.OPRYN_PGLITE_MODULE || "@electric-sql/pglite"
);
const dependencyMocks = {
  "server-only": "",
  "@/lib/ai/config": "export const OPENAI_MODELS={};",
  "@/lib/ai/services":
    "export const extractProcessFromTranscript=()=>{throw new Error('unexpected model call')};",
  "@/lib/processes":
    "export const replaceExtractedProcess=()=>{throw new Error('unexpected write')};",
  "@/lib/supabase/service":
    "export const createServiceClient=()=>{throw new Error('unexpected real client')};",
  "@/lib/opryn/knowledge/proposals":
    "export const createKnowledgeProposalsForProcess=()=>{throw new Error('unexpected proposal')};",
};
const workerBundle = await build({
  entryPoints: ["lib/opryn/mcp/learning.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "worker-services",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) =>
          Object.hasOwn(dependencyMocks, a.path)
            ? { path: a.path, namespace: "fixture" }
            : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: dependencyMocks[a.path],
          loader: "js",
        }));
      },
    },
  ],
});
const workerModule = { exports: {} };
new Function("require", "module", "exports", workerBundle.outputFiles[0].text)(
  require,
  workerModule,
  workerModule.exports,
);
let active = true,
  attempts = 0,
  claimFilters = [];
const workerService = {
  from() {
    let updating = false;
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        if (updating) claimFilters.push([k, v]);
        return q;
      },
      update() {
        attempts++;
        updating = true;
        return q;
      },
      maybeSingle: async () => ({
        data: updating
          ? null
          : {
              id: "job",
              status: active ? "processing" : "received",
              context_text: "business context",
              updated_at: new Date().toISOString(),
            },
        error: null,
      }),
    };
    return q;
  },
};
await workerModule.exports.processExternalLearningJob(workerService, "job");
assert.equal(attempts, 0, "active worker is not duplicated");
active = false;
await workerModule.exports.processExternalLearningJob(workerService, "job");
assert.equal(attempts, 1, "ready job attempts a claim");
assert.ok(
  claimFilters.some(([k]) => k === "updated_at"),
  "claim uses database revision predicate",
);
const db = new PGlite();
try {
  await db.exec(
    "create table public.external_learning_jobs(id uuid, organization_id uuid, created_by uuid)",
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260916070000_onboarding_learning_requests.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260916070000_onboarding_learning_requests.sql",
      "utf8",
    ),
  );
  const insert =
    "insert into external_learning_jobs values ('60000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',$1)";
  await db.query(insert, [id]);
  await assert.rejects(
    db.query(insert, [id]),
    (error) => error.code === "23505",
  );
  await db.query(insert, [null]);
  await db.query(insert, [null]);
  console.log(
    "PASS handoff: user/workspace/provider binding; expiry; wrong reference; linked-job guard; additive migration repeatability and unique concurrent-request constraint; legacy null jobs remain valid",
  );
} finally {
  await db.close();
}
