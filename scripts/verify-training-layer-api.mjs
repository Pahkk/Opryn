// Execute actual route handlers with isolated auth/database/model boundaries.
import assert from "node:assert/strict";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
const entry = `export {POST as assign} from './app/api/training/knowledge/route';export {POST as scenario} from './app/api/training/scenarios/route';export {POST as practice} from './app/api/training/practice/route';export {POST as feedback} from './app/api/training/feedback/route';export {POST as agent} from './app/api/training/agents/route';`;
const b = await build({
  stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" },
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
              /^(next\/server|@\/lib\/(api|supabase\/service|opryn\/knowledge\/(trust|scope-context)|ai\/learning-practice|ai\/services))$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        build.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "next/server"
              ? "export const NextResponse={json:(body,init)=>new Response(JSON.stringify(body),init)};"
              : a.path.endsWith("/api")
                ? 'export const getRequestContext=async(options)=>{globalThis.requestedAuth=options;return globalThis.context};export const apiError=()=>new Response(JSON.stringify({error:"safe_error"}),{status:500});'
                : a.path.endsWith("/service")
                  ? "export const createServiceClient=()=>globalThis.database;"
                  : a.path.endsWith("/trust")
                    ? "export const trustedAnswerContext=async(db,org,rows)=>globalThis.trusted?rows:[];"
                    : a.path.endsWith("/scope-context")
                      ? "export const memberScopeContext=async()=>({});"
                      : a.path.endsWith("/learning-practice")
                        ? 'export const reviewLearningPractice=async()=>({result:"missing_detail",feedback:"Manager approval is required.",supportingQuote:"Manager approval"});'
                        : "",
          loader: "js",
        }));
      },
    },
  ],
});
// Resolve external zod from this repository, not a temporary data URL.
const { writeFile, unlink } = await import("node:fs/promises");
const file = new URL("../.training-api-verification.mjs", import.meta.url);
await writeFile(file, b.outputFiles[0].text);
const routes = await import(file.href);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1),
  user = id(2),
  knowledge = id(3),
  assignment = id(4);
const calls = [];
let assignmentExists = true;
globalThis.database = {
  from(table) {
    let filters = [];
    const q = {
      select() {
        return q;
      },
      eq(k, v) {
        filters.push([k, v]);
        return q;
      },
      is() {
        return q;
      },
      maybeSingle: async () => {
        calls.push({ table, filters });
        if (table === "training_assignments")
          return {
            data: assignmentExists
              ? { id: assignment, knowledge_chunk_id: knowledge }
              : null,
          };
        if (table === "knowledge_chunks")
          return {
            data: {
              id: knowledge,
              current_version: 1,
              content: "Manager approval is required.",
              approved: true,
            },
          };
        if (table === "training_scenarios")
          return {
            data: {
              id: id(5),
              revision: 1,
              prompt: "What approval is required?",
            },
          };
        return { data: null };
      },
    };
    return q;
  },
  rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: name === "consume_training_budget" ? true : 1 };
  },
};
globalThis.context = {
  membership: { organization_id: org },
  user: { id: user },
  supabase: globalThis.database,
};
globalThis.trusted = true;
const request = (body, origin = "https://opryn.test") =>
  new Request("https://opryn.test/api/training/test", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
try {
  for (const handler of Object.values(routes))
    assert.equal(
      (await handler(request({}, "https://evil.test"))).status,
      403,
      "cross-origin rejected before data",
    );
  assert.equal(
    (
      await routes.assign(
        request({
          roleId: id(6),
          knowledgeIds: [knowledge],
          organizationId: id(99),
        }),
      )
    ).status,
    400,
    "client tenant ID rejected",
  );
  assert.equal(
    (await routes.assign(request({ roleId: id(6), knowledgeIds: [knowledge] })))
      .status,
    200,
  );
  assert.equal(globalThis.requestedAuth.admin, true);
  assert.equal(calls.at(-1).args.target_org, org);
  const context = globalThis.context;
  globalThis.context = { error: new Response("unauthorized", { status: 401 }) };
  for (const handler of Object.values(routes))
    assert.equal((await handler(request({}))).status, 401);
  globalThis.context = context;
  assignmentExists = false;
  assert.equal(
    (
      await routes.practice(
        request({
          assignmentId: assignment,
          version: 1,
          action: "acknowledge",
        }),
      )
    ).status,
    403,
  );
  assignmentExists = true;
  globalThis.trusted = false;
  assert.equal(
    (
      await routes.practice(
        request({
          assignmentId: assignment,
          version: 1,
          action: "acknowledge",
        }),
      )
    ).status,
    409,
  );
  globalThis.trusted = true;
  assert.equal(
    (
      await routes.practice(
        request({
          assignmentId: assignment,
          version: 9,
          action: "acknowledge",
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await routes.practice(
        request({
          assignmentId: assignment,
          version: 1,
          action: "practice",
          response: "I can refund without approval.",
        }),
      )
    ).status,
    200,
  );
  const commit = calls.findLast((c) => c.name === "commit_training_attempt");
  assert.equal(
    commit.args.outcome_value,
    "practice_needed",
    "unsupported practice cannot mark Ready",
  );
  assert.equal(commit.args.target_org, org);
  assert.equal(commit.args.target_user, user);
  for (const call of calls.filter((c) => c.table)) {
    assert.ok(
      call.filters.some(([k, v]) => k === "organization_id" && v === org),
      "query bounded to authenticated organization",
    );
    if (call.table === "training_assignments")
      assert.ok(
        call.filters.some(([k, v]) => k === "user_id" && v === user),
        "member cannot practice another person’s assignment",
      );
  }
  console.log(
    "PASS: real API handlers reject cross-origin/unauthenticated requests, reject client-selected tenant IDs, request admin authorization, constrain queries by workspace/user, reject missing assignments/stale/untrusted guidance, and persist failed practice without granting readiness. Isolated providers.",
  );
} finally {
  await unlink(file);
}
