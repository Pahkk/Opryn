import assert from "node:assert/strict";
import { build } from "/private/tmp/opryn-training-verification/node_modules/esbuild/lib/main.js";
import { writeFile, unlink } from "node:fs/promises";
const b = await build({
  entryPoints: ["app/api/v1/evaluations/route.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "boundaries",
      setup(build) {
        build.onResolve(
          {
            filter:
              /^(next\/server|@\/lib\/(external-ai\/auth|training\/evaluations))$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        build.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          loader: "js",
          contents:
            a.path === "next/server"
              ? "export const after=fn=>globalThis.worker=fn;"
              : a.path.endsWith("/auth")
                ? 'export const authenticateExternalAI=async(req,scope)=>{globalThis.scope=scope;if(globalThis.denied)throw new Error("denied");return globalThis.auth};export const externalJSON=(body,init)=>new Response(JSON.stringify(body),init);export const externalAIError=()=>new Response("unauthorized",{status:401});'
                : "export const processTrainingEvaluations=async()=>({processed:1});",
        }));
      },
    },
  ],
});
const file = new URL(
  "../.training-submission-api-verification.mjs",
  import.meta.url,
);
await writeFile(file, b.outputFiles[0].text);
try {
  const { POST, GET } = await import(file.href);
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = id(1),
    connection = id(2),
    key = id(3),
    test = id(4),
    requestId = id(5);
  let args,
    sqlError = null,
    missingRun = false;
  globalThis.auth = {
    connection: { organization_id: org, id: connection },
    keyId: key,
    scopes: new Set(["knowledge:read"]),
    service: {
      rpc: async (name, payload) => {
        assert.ok(
          [
            "submit_agent_training_response",
            "read_agent_training_run",
          ].includes(name),
        );
        args = payload;
        return {
          data:
            name === "read_agent_training_run"
              ? missingRun
                ? null
                : { run_id: id(6), status: "failed" }
              : id(6),
          error: sqlError,
        };
      },
    },
  };
  const payload = {
    test_id: test,
    request_id: requestId,
    answer: "Manager approval required.",
    sources: [],
  };
  const submit = (body) =>
    POST(
      new Request("https://opryn.test/api/v1/evaluations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  globalThis.denied = true;
  assert.equal((await submit(payload)).status, 401);
  globalThis.denied = false;
  globalThis.auth.scopes.clear();
  assert.equal((await submit(payload)).status, 403);
  globalThis.auth.scopes.add("knowledge:read");
  assert.equal(
    (await submit({ ...payload, organization_id: id(9) })).status,
    400,
    "client cannot inject tenant",
  );
  assert.equal(
    (await submit({ ...payload, sources: [{ id: id(7), version: 0 }] })).status,
    400,
  );
  const response = await submit(payload);
  assert.equal(response.status, 202);
  assert.equal(globalThis.scope, "evaluations:create");
  assert.equal(args.target_org, org);
  assert.equal(args.target_connection, connection);
  assert.equal(args.target_key, key);
  assert.equal(args.target_test, test);
  assert.equal(args.request_id, requestId);
  assert.equal(typeof globalThis.worker, "function");
  sqlError = { code: "42501" };
  assert.equal((await submit(payload)).status, 403);
  sqlError = { code: "23505" };
  assert.equal((await submit(payload)).status, 409);
  sqlError = null;
  assert.equal(
    (await GET(new Request("https://opryn.test/api/v1/evaluations"))).status,
    400,
  );
  assert.equal(
    (
      await GET(
        new Request(`https://opryn.test/api/v1/evaluations?run_id=${id(6)}`),
      )
    ).status,
    200,
  );
  assert.equal(args.target_org, org);
  assert.equal(args.target_connection, connection);
  assert.equal(args.target_key, key);
  assert.equal(args.target_run, id(6));
  missingRun = true;
  assert.equal(
    (
      await GET(
        new Request(`https://opryn.test/api/v1/evaluations?run_id=${id(6)}`),
      )
    ).status,
    404,
  );
  sqlError = { code: "42501" };
  assert.equal(
    (
      await GET(
        new Request(`https://opryn.test/api/v1/evaluations?run_id=${id(6)}`),
      )
    ).status,
    403,
  );
  console.log(
    "PASS: external submission authentication, opt-in scope, strict payload, tenant/key binding, async acceptance, revoked access, pending-run conflict and tenant-bound result polling. Auth/database/worker boundaries mocked.",
  );
} finally {
  await unlink(file);
}
