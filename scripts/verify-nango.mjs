// Actual PostgreSQL execution in an isolated in-memory database; no live provider calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";
import * as crypto from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ??
      "/private/tmp/opryn-nango-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table organizations(id uuid primary key);
create table profiles(id uuid primary key);
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create table integrations(id uuid primary key default gen_random_uuid(),organization_id uuid,provider text,connection_type text,auth_platform text,provider_config_key text,external_connection_id text,status text,capabilities text[],connected_by uuid,connected_at timestamptz,unique(organization_id,provider));
create table integration_events(id uuid primary key default gen_random_uuid(),organization_id uuid,integration_id uuid,provider text,event_type text,actor_id uuid,metadata jsonb);
grant usage on schema public to authenticated,service_role;
grant all on integrations to authenticated,service_role;
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260911010000_nango_connections.sql",
    "utf8",
  ),
);
await db.exec(
  readFileSync(
    "supabase/migrations/20260911020000_google_workspace_selection.sql",
    "utf8",
  ),
);
const orgA = "10000000-0000-4000-8000-000000000001",
  orgB = "10000000-0000-4000-8000-000000000002",
  owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002";
await db.query("insert into organizations values ($1),($2)", [orgA, orgB]);
await db.query("insert into profiles values ($1),($2)", [owner, member]);
await db.query(
  "insert into organization_members values ($1,$2,'owner'),($1,$3,'member')",
  [orgA, owner, member],
);
const begin = async (org = orgA, user = owner) =>
  (
    await db.query(
      "select begin_nango_connection($1,$2,'google_drive','drive-dev','DEV') id",
      [org, user],
    )
  ).rows[0].id;
const confirm = async (id, connection = "remote-a", status = "connected") =>
  (
    await db.query(
      "select confirm_nango_connection($1,$2,$3,'creation',array['knowledge_import']) id",
      [id, connection, status],
    )
  ).rows[0].id;
await assert.rejects(begin(orgA, member), /Forbidden/);
await assert.rejects(begin(orgB, owner), /Forbidden/);
const attempt = await begin();
await assert.rejects(begin(), /already in progress/);
const connection = await confirm(attempt);
assert.ok(connection);
assert.equal(await confirm(attempt), connection);
await db.query(`update integrations set configuration=$1::jsonb where id=$2`, [
  JSON.stringify({
    environment: "DEV",
    selected_files: [{ id: "selected-google-file" }],
  }),
  connection,
]);
await confirm(attempt);
assert.equal(
  (
    await db.query(
      "select configuration->'selected_files'->0->>'id' selected from integrations where id=$1",
      [connection],
    )
  ).rows[0].selected,
  "selected-google-file",
);
assert.equal(
  (await db.query("select count(*)::int n from integrations")).rows[0].n,
  1,
);
assert.equal(
  (await db.query("select count(*)::int n from integration_events")).rows[0].n,
  1,
);
assert.equal(await confirm(attempt, "remote-b"), null);
await confirm(attempt, "remote-a", "needs_reauthorization");
assert.equal(
  (await db.query("select status from integrations")).rows[0].status,
  "needs_reauthorization",
);
await confirm(attempt);
await db.exec("set role authenticated");
await assert.rejects(
  db.query("update integrations set external_connection_id='forged'"),
  /server managed/,
);
await assert.rejects(db.query("delete from integrations"), /server managed/);
await assert.rejects(
  db.query("select * from integration_connect_attempts"),
  /permission denied/,
);
await assert.rejects(begin(), /permission denied/);
await db.exec("reset role");
assert.equal(
  (
    await db
      .query("select stop_nango_connection($1,$2,$3) ok", [
        orgB,
        owner,
        connection,
      ])
      .catch(() => ({ rows: [{ ok: false }] }))
  ).rows[0].ok,
  false,
);
assert.equal(
  (
    await db.query("select stop_nango_connection($1,$2,$3) ok", [
      orgA,
      owner,
      connection,
    ])
  ).rows[0].ok,
  true,
);
await assert.rejects(begin(), /Finish disconnecting first/);
await db.query("update integrations set error_code=null");
await db.query("update integrations set status='disconnected'");
await confirm(attempt);
assert.equal(
  (await db.query("select status from integrations")).rows[0].status,
  "disconnected",
);
const revoked = await begin();
await db.query(
  "update organization_members set permission_level='member' where user_id=$1",
  [owner],
);
assert.equal(await confirm(revoked, "remote-new"), null);
await db.query(
  "update organization_members set permission_level='owner' where user_id=$1",
  [owner],
);
await db.query(
  "update integration_connect_attempts set status='cancelled' where id=$1",
  [revoked],
);
assert.equal(await confirm(revoked, "remote-new"), null);
const expired = await begin();
await db.query(
  "update integration_connect_attempts set expires_at=now()-interval '1 minute' where id=$1",
  [expired],
);
assert.equal(await confirm(expired, "remote-new"), null);
assert.ok(await begin());
await db.close();

const exports = {};
vm.runInNewContext(
  ts.transpileModule(readFileSync("lib/integrations/nango.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    exports,
    Buffer,
    process: { env: {} },
    AbortSignal,
    require(name) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name === "zod") return { z };
      throw new Error(name);
    },
  },
);
const body = JSON.stringify({ type: "auth", success: true });
const signature = createHmac("sha256", "test-only-signing-key")
  .update(body)
  .digest("hex");
assert.equal(
  exports.verifyNangoWebhook(body, signature, "test-only-signing-key"),
  true,
);
assert.equal(
  exports.verifyNangoWebhook(body + " ", signature, "test-only-signing-key"),
  false,
);
assert.equal(exports.verifyNangoWebhook(body, signature, "wrong-key"), false);
assert.equal(
  exports.verifyNangoWebhook(body, null, "test-only-signing-key"),
  false,
);
assert.equal(
  exports.verifyNangoWebhook(body, "not-hex", "test-only-signing-key"),
  false,
);
assert.throws(() => exports.nangoEnvironment(), /not available/);
console.log(
  "Nango: PostgreSQL migration, permission guards, duplicate confirmation, lifecycle, cancellation, expiry, revoked owner, and HMAC checks passed. No live OAuth tested.",
);

// Route contracts use explicit database/Nango doubles; production handlers are loaded unchanged.
let context,
  row,
  rpcCalls = [],
  remoteCalls = 0,
  rateAllowed = true;
const filters = [];
const query = {
  select() {
    return this;
  },
  in(key, value) {
    filters.push([key, value]);
    return this;
  },
  eq(key, value) {
    filters.push([key, value]);
    return this;
  },
  gt() {
    return this;
  },
  order() {
    return this;
  },
  limit() {
    return this;
  },
  update() {
    return this;
  },
  maybeSingle: async () => ({ data: row, error: null }),
  single: async () => ({ data: row, error: null }),
  then(resolve) {
    return Promise.resolve({ data: row, error: null }).then(resolve);
  },
};
const storage = {
  from: () => query,
  rpc: async (name, args) => {
    rpcCalls.push([name, args]);
    return {
      data:
        name === "begin_nango_connection"
          ? "30000000-0000-4000-8000-000000000001"
          : true,
      error: null,
    };
  },
};
function route(path, extra = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      Buffer,
      Request,
      Response,
      URL,
      console,
      process: { env: { NANGO_WEBHOOK_SECRET: "test-only-signing-key" } },
      require(name) {
        const deps = {
          "next/server": { NextResponse: Response },
          zod: { z },
          "@/lib/api": { getRequestContext: async () => context },
          "@/lib/supabase/service": { createServiceClient: () => storage },
          "@/lib/integrations/nango-providers": {
            getNangoProvider: (id) => {
              if (id !== "google_drive") throw new Error("Invalid provider");
              return {
                id,
                integrationId: "drive-dev",
                capabilities: ["knowledge_import"],
              };
            },
          },
          "@/lib/integrations/nango-capabilities": {
            requireNangoCapability: async () => {
              throw new Error(
                "Capability lookup should not run for a missing connection",
              );
            },
            driveRequest: async () => Response.json({}),
          },
          "@/lib/integrations/nango": {
            ...nango,
            nangoEnvironment: () => "DEV",
            nangoRequest: async () => {
              remoteCalls++;
              return Response.json({
                data: {
                  token: "test-session",
                  expires_at: "2026-09-11T12:00:00Z",
                },
              });
            },
            ...extra,
          },
        };
        if (name in deps) return deps[name];
        throw new Error(name);
      },
    },
  );
  return exports;
}
const nango = exports;
const sessionRoute = route("app/api/integrations/nango/session/route.ts");
const sessionRequest = (
  body = { provider: "google_drive", organizationId: orgA },
) =>
  new Request("https://opryn.test/api/integrations/nango/session", {
    method: "POST",
    headers: {
      origin: "https://opryn.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
context = { error: Response.json({ error: "Sign in" }, { status: 401 }) };
assert.equal((await sessionRoute.POST(sessionRequest())).status, 401);
context = { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
assert.equal((await sessionRoute.POST(sessionRequest())).status, 403);
context = {
  user: { id: owner },
  membership: { organization_id: orgA },
  supabase: {
    ...storage,
    rpc: async () => ({ data: rateAllowed, error: null }),
  },
};
assert.equal(
  (
    await sessionRoute.POST(
      sessionRequest({ provider: "google_drive", organizationId: orgB }),
    )
  ).status,
  409,
);
assert.equal(
  (
    await sessionRoute.POST(
      sessionRequest({
        provider: "google_drive",
        organizationId: orgA,
        credentials: "forbidden",
      }),
    )
  ).status,
  400,
);
assert.notEqual(
  (
    await sessionRoute.POST(
      sessionRequest({ provider: "not-a-provider", organizationId: orgA }),
    )
  ).status,
  200,
);
rateAllowed = false;
assert.equal((await sessionRoute.POST(sessionRequest())).status, 429);
assert.equal(remoteCalls, 0);
rateAllowed = true;
row = { connection_id: null };
const allowed = await sessionRoute.POST(sessionRequest());
assert.equal(allowed.status, 200);
assert.equal((await allowed.json()).sessionToken, "test-session");
assert.equal(remoteCalls, 1);

const attemptId = "30000000-0000-4000-8000-000000000001";
const remoteConnectionId = "google-workspace-connection";
row = {
  id: attemptId,
  organization_id: orgA,
  user_id: owner,
  provider: "google_drive",
  integration_key: "drive-dev",
  connection_id: null,
  status: "pending",
  expires_at: "2099-01-01T00:00:00Z",
};
let confirmationRemoteOrg = orgA;
const attemptRoute = route(
  "app/api/integrations/nango/attempts/[id]/route.ts",
  {
    readNangoConnection: async () => ({
      connection_id: remoteConnectionId,
      provider_config_key: "drive-dev",
      tags: {
        organization_id: confirmationRemoteOrg,
        end_user_id: owner,
        opryn_attempt_id: attemptId,
      },
      errors: [],
    }),
  },
);
const confirmationRequest = (origin = "https://opryn.test") =>
  new Request(
    `https://opryn.test/api/integrations/nango/attempts/${attemptId}`,
    {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: remoteConnectionId,
        providerConfigKey: "drive-dev",
      }),
    },
  );
assert.equal(
  (
    await attemptRoute.POST(confirmationRequest("https://attacker.test"), {
      params: Promise.resolve({ id: attemptId }),
    })
  ).status,
  403,
);
rpcCalls = [];
const confirmedFromBrowser = await attemptRoute.POST(confirmationRequest(), {
  params: Promise.resolve({ id: attemptId }),
});
assert.equal(confirmedFromBrowser.status, 200);
assert.equal(rpcCalls[0][0], "confirm_nango_connection");
assert.equal(rpcCalls[0][1].remote_connection_id, remoteConnectionId);
confirmationRemoteOrg = orgB;
rpcCalls = [];
assert.equal(
  (
    await attemptRoute.POST(confirmationRequest(), {
      params: Promise.resolve({ id: attemptId }),
    })
  ).status,
  409,
);
assert.equal(rpcCalls.length, 0);
confirmationRemoteOrg = orgA;

const manageRoute = route("app/api/integrations/nango/[id]/route.ts");
row = null;
filters.length = 0;
const missing = await manageRoute.GET(new Request("https://opryn.test"), {
  params: Promise.resolve({ id: "other-org-connection" }),
});
assert.equal(missing.status, 404);
assert.ok(filters.some(([k, v]) => k === "organization_id" && v === orgA));
const deniedDelete = await manageRoute.DELETE(
  new Request("https://opryn.test", {
    method: "DELETE",
    headers: { origin: "https://opryn.test" },
  }),
  { params: Promise.resolve({ id: "other-org-connection" }) },
);
assert.equal(deniedDelete.status, 404);
assert.equal(remoteCalls, 1);
const webhook = route("app/api/webhooks/nango/route.ts");
const signedRequest = (body, key = "test-only-signing-key") =>
  new Request("https://opryn.test/api/webhooks/nango", {
    method: "POST",
    headers: {
      "x-nango-hmac-sha256": createHmac("sha256", key)
        .update(body)
        .digest("hex"),
    },
    body,
  });
assert.equal((await webhook.POST(signedRequest(body, "wrong"))).status, 401);
assert.equal(
  (
    await webhook.POST(
      signedRequest(JSON.stringify({ type: "new_future_event" })),
    )
  ).status,
  200,
);
const unknown = JSON.stringify({
  type: "auth",
  operation: "creation",
  connectionId: "unknown",
  providerConfigKey: "drive-dev",
  environment: "DEV",
  success: true,
  tags: {
    organization_id: orgA,
    opryn_attempt_id: "30000000-0000-4000-8000-000000000001",
  },
});
assert.equal((await webhook.POST(signedRequest(unknown))).status, 200);
console.log(
  "Nango API contracts passed: logged-out/member denial, active-org mismatch, invalid input/provider, rate limit, owner session, cross-org read/delete, invalid signature and unknown events. External services explicitly mocked.",
);

const knownEvent = JSON.parse(unknown);
row = {
  id: knownEvent.tags.opryn_attempt_id,
  organization_id: orgA,
  user_id: owner,
  provider: "google_drive",
  integration_key: "drive-dev",
  environment: "DEV",
  status: "pending",
  expires_at: "2099-01-01T00:00:00Z",
};
let remoteOrg = orgA;
const knownWebhook = route("app/api/webhooks/nango/route.ts", {
  readNangoConnection: async () => ({
    connection_id: knownEvent.connectionId,
    provider_config_key: "drive-dev",
    tags: {
      organization_id: remoteOrg,
      end_user_id: owner,
      opryn_attempt_id: row.id,
    },
    errors: [],
  }),
});
rpcCalls = [];
assert.equal(
  (await knownWebhook.POST(signedRequest(JSON.stringify(knownEvent)))).status,
  200,
);
assert.equal(rpcCalls[0][0], "confirm_nango_connection");
assert.equal(rpcCalls[0][1].target_status, "connected");
remoteOrg = orgB;
rpcCalls = [];
assert.equal(
  (await knownWebhook.POST(signedRequest(JSON.stringify(knownEvent)))).status,
  200,
);
assert.equal(
  rpcCalls.length,
  0,
  "Remote tenant mismatch must never persist a connection",
);
remoteOrg = orgA;
filters.length = 0;
await knownWebhook.POST(
  signedRequest(JSON.stringify({ ...knownEvent, operation: "refresh" })),
);
assert.ok(
  filters.some(
    ([key, value]) =>
      key === "status" && value.length === 1 && value[0] === "confirmed",
  ),
  "A refresh event must not complete a pending reauthorization",
);
console.log(
  "Known signed webhook reconciliation and remote tenant mismatch checks passed; refresh cannot confirm pending OAuth.",
);
