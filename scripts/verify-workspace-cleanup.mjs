// Real cleanup orchestration, isolated adapters. Never touches provider accounts.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  org = "10000000-0000-4000-8000-000000000001";
let state;
function reset(overrides = {}) {
  state = {
    events: [],
    remoteStatus: 200,
    files: true,
    storageFail: false,
    customer: "cus_1",
    ...overrides,
  };
  globalThis.__cleanup = state;
}
globalThis.__db = {
  from(table) {
    const q = { table, operation: "read", filters: [] };
    const chain = {
      select() {
        return chain;
      },
      update(value) {
        q.operation = "update";
        q.value = value;
        return chain;
      },
      delete() {
        q.operation = "delete";
        return chain;
      },
      eq(k, v) {
        q.filters.push([k, v]);
        return chain;
      },
      maybeSingle() {
        return chain;
      },
      then(resolve) {
        state.events.push(q);
        assert(
          q.filters.some(([k, v]) => k === "organization_id" && v === org),
        );
        let data = null;
        if (q.operation === "read" && table === "integrations")
          data = [
            {
              id: "connection-1",
              auth_platform: "nango",
              provider_config_key: "google",
              external_connection_id: "remote-1",
              configuration: { environment: "PROD" },
              status: "connected",
              error_code: null,
            },
          ];
        if (q.operation === "read" && table === "organization_subscriptions")
          data = {
            stripe_subscription_id: "sub_1",
            stripe_customer_id: "cus_1",
          };
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return chain;
  },
  async rpc(name, args) {
    state.events.push({ rpc: name, args });
    assert.equal(args.target_org ?? args.workspace_id, org);
    return {
      error: null,
      data:
        name === "stop_nango_connection"
          ? true
          : state.files
            ? [{ bucket_id: "process-media", name: org + "/document.pdf" }]
            : [],
    };
  },
  storage: {
    from(bucket) {
      return {
        async remove(paths) {
          state.events.push({ storage: bucket, paths });
          assert(paths.every((p) => p.startsWith(org + "/")));
          if (state.storageFail) return { error: {} };
          state.files = false;
          return { error: null };
        },
      };
    },
  },
};
const result = await build({
  entryPoints: ["lib/workspace-deletion.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(server-only|@\/lib\/supabase\/service|@\/lib\/billing\/stripe|@\/lib\/integrations\/nango)$/,
          },
          (a) => ({ path: a.path, namespace: "mock" }),
        );
        b.onLoad({ filter: /.*/, namespace: "mock" }, (a) => ({
          contents:
            a.path === "server-only"
              ? ""
              : a.path.endsWith("service")
                ? "export const createServiceClient=()=>globalThis.__db"
                : a.path.endsWith("stripe")
                  ? `export const getStripe=()=>({subscriptions:{retrieve:async()=>({id:'sub_1',customer:globalThis.__cleanup.customer,status:'active',metadata:{organization_id:'${org}'}}),cancel:async(id,options)=>{globalThis.__cleanup.events.push({cancel:id,options});return {status:'canceled'}}}})`
                  : `export class ConnectionError extends Error {constructor(message,status){super(message);this.status=status}}export const nangoEnvironment=()=>'PROD';export const connectionPath=(a,b)=>a+'/'+b;export const nangoRequest=async(path,options)=>{globalThis.__cleanup.events.push({remote:path,options});if(globalThis.__cleanup.remoteStatus!==200)throw new ConnectionError('private provider error',globalThis.__cleanup.remoteStatus);};`,
        }));
      },
    },
  ],
});
const mod = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  require,
  mod,
  mod.exports,
);
const cleanup = () => mod.exports.cleanupWorkspace(org, "owner-1");
reset();
await cleanup();
assert(state.events.some((e) => e.remote));
assert(state.events.some((e) => e.cancel === "sub_1"));
assert(state.events.some((e) => e.storage));
assert(
  state.events.findIndex((e) => e.rpc === "stop_nango_connection") <
    state.events.findIndex((e) => e.remote),
);
reset({ remoteStatus: 404 });
await cleanup();
reset({ remoteStatus: 503 });
await assert.rejects(cleanup());
assert(!state.events.some((e) => e.cancel || e.storage));
assert(!state.events.some((e) => e.value?.error_code === null));
reset({ storageFail: true });
await assert.rejects(cleanup());
state.storageFail = false;
await cleanup();
reset({ customer: "another_workspace_customer" });
await assert.rejects(cleanup());
assert(!state.events.some((e) => e.cancel || e.storage));
console.log(
  "PASS cleanup with mock adapters: tenant predicates, disconnect-before-remote-delete, 404 retry, provider failure retains pending state, storage retry, billing ownership and cancellation parameters.",
);
