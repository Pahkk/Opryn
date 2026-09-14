import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the real route with an authenticated client that cannot write jobs.
// No production credentials, documents, or database writes are used.
const source = readFileSync(
  new URL("../app/api/processes/[id]/approve/route.ts", import.meta.url),
  "utf8",
);
const reviewSource = readFileSync(
  new URL("../components/app/process-review.tsx", import.meta.url),
  "utf8",
);
assert.match(
  reviewSource,
  /\{saving !== "approve" \? \([\s\S]*?Save Draft[\s\S]*?\) : null\}/,
  "Save controls must leave the DOM while approval is running",
);
assert.match(
  reviewSource,
  /if\s*\(approved\)\s*return\s*\(\s*<section\s+role="status"/,
  "Successful approval must replace the editor with the dedicated result state",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const writes = [];
let authorized = true;
let serviceCalls = 0;
let embeddingFails = false;
const json = (body, options = {}) =>
  new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: { "content-type": "application/json" },
  });
function client(privileged = false) {
  return {
    from(table) {
      let action = "read";
      const filters = [];
      const chain = new Proxy(
        {},
        {
          get(_target, key) {
            if (key === "then")
              return (resolve) => {
                if (action !== "read")
                  writes.push({ table, action, privileged, filters });
                if (
                  table === "external_learning_jobs" &&
                  action !== "read" &&
                  !privileged
                )
                  return Promise.resolve(
                    resolve({ data: null, error: { code: "42501" } }),
                  );
                const data =
                  action !== "read"
                    ? table === "knowledge_chunks"
                      ? { id: "chunk" }
                      : null
                    : table === "processes"
                      ? {
                          id: "process",
                          title: "Revision policy",
                          summary: "Two revisions.",
                          purpose: "Client delivery",
                          learning_source: "ai_conversation",
                        }
                      : [];
                return Promise.resolve(resolve({ data, error: null }));
              };
            return (...args) => {
              if (["insert", "update", "upsert", "delete"].includes(key))
                action = key;
              if (key === "eq") filters.push(args);
              return chain;
            };
          },
        },
      );
      return chain;
    },
  };
}
const exports = {};
const dependencies = {
  exports,
  console: { error() {} },
  require(name) {
    if (name === "server-only") return {};
    if (name === "@/lib/opryn/knowledge/trust")
      return {
        assertNoBlockingKnowledgeConflict: async () => {},
        KnowledgeConflictError: class KnowledgeConflictError extends Error {},
      };
    if (name === "@/lib/opryn/processes/approval") {
      const helper = {};
      vm.runInNewContext(
        ts.transpileModule(
          readFileSync(
            new URL("../lib/opryn/processes/approval.ts", import.meta.url),
            "utf8",
          ),
          {
            compilerOptions: {
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2022,
            },
          },
        ).outputText,
        { ...dependencies, exports: helper },
      );
      return helper;
    }
    if (name === "next/server") return { NextResponse: { json } };
    if (name === "@/lib/api")
      return {
        getRequestContext: async () =>
          authorized
            ? {
                supabase: client(),
                user: { id: "owner" },
                membership: { organization_id: "company" },
              }
            : { error: json({ error: "Forbidden" }, { status: 403 }) },
        apiError: (_error, message) =>
          json({ error: message }, { status: 500 }),
      };
    if (name === "@/lib/ai/services")
      return {
        embedKnowledge: async () => {
          if (embeddingFails) throw new Error("Unavailable");
          return [[0]];
        },
      };
    if (name === "@/lib/supabase/service")
      return {
        createServiceClient: () => {
          serviceCalls++;
          return client(true);
        },
      };
    throw new Error(`Unexpected dependency: ${name}`);
  },
};
vm.runInNewContext(compiled, dependencies);
const request = () =>
  exports.POST(
    new Request("https://opryn.test/api/processes/process/approve", {
      method: "POST",
    }),
    { params: Promise.resolve({ id: "process" }) },
  );
assert.equal((await request()).status, 200);
const jobWrite = writes.find(
  (write) => write.table === "external_learning_jobs",
);
assert.equal(jobWrite.privileged, true);
assert.deepEqual(jobWrite.filters, [
  ["process_id", "process"],
  ["organization_id", "company"],
]);
authorized = false;
const before = serviceCalls;
assert.equal((await request()).status, 403);
assert.equal(serviceCalls, before);
authorized = true;
embeddingFails = true;
const failed = await request();
assert.equal(failed.status, 500);
assert.match(
  (await failed.json()).error,
  /couldn't prepare the approved answers/,
);
console.log(
  "Approval passed with read-only job permissions; service update stays company-scoped; unauthorized access and embedding failure checks passed.",
);
