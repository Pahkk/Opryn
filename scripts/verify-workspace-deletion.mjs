// Isolated PostgreSQL fixtures only. Never connects to production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ||
      "/private/tmp/opryn-nango-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','oauth','timestamp',coalesce(nullif(current_setting('test.time',true),''),'0')::numeric))) $$;
create table organizations(id uuid primary key,name text);
create table organization_members(organization_id uuid references organizations on delete cascade,user_id uuid,permission_level text);
create table organization_subscriptions(organization_id uuid references organizations on delete cascade,stripe_customer_id text,stripe_subscription_id text);
create table storage.objects(name text);
create table knowledge(organization_id uuid references organizations on delete cascade,content text);
`);
for (const table of [
  "integrations",
  "integration_connect_attempts",
  "communication_integrations",
  "communication_oauth_states",
  "phone_integrations",
])
  await db.exec(
    `create table ${table}(organization_id uuid references organizations on delete cascade);`,
  );
await db.exec(
  readFileSync(
    "supabase/migrations/20260914030000_guarded_workspace_deletion.sql",
    "utf8",
  ),
);
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002";
await db.exec(
  `insert into organizations values('${org}','Example'),('${other}','Other');insert into organization_members values('${org}','${owner}','owner'),('${org}','${member}','admin');insert into knowledge values('${org}','Rule'),('${other}','Other rule');`,
);
async function actor(user, age = 0) {
  await db.exec(
    `reset role;select set_config('test.user','${user}',false);select set_config('test.time',(extract(epoch from now())-${age})::text,false);set role authenticated;`,
  );
}
const remove = (id = org, name = "Example") =>
  db.query("select delete_workspace_safely($1,$2)", [id, name]);
await actor(member);
await assert.rejects(remove(), (e) => e.code === "42501");
await actor(owner);
await assert.rejects(remove(other), (e) => e.code === "42501");
await assert.rejects(remove(org, "Wrong"), (e) => e.code === "22023");
await actor(owner, 601);
await assert.rejects(remove(), (e) => e.code === "P0002");
await actor(owner);
for (const [table, values, code] of [
  ["organization_subscriptions", `'${org}','cus_example',null`, "P0003"],
  ...[
    "integrations",
    "integration_connect_attempts",
    "communication_integrations",
    "communication_oauth_states",
    "phone_integrations",
  ].map((t) => [t, `'${org}'`, "P0004"]),
  ["storage.objects", `'${org}/example.pdf'`, "P0005"],
]) {
  await db.exec(
    `reset role;insert into ${table} values(${values});set role authenticated;`,
  );
  await assert.rejects(remove(), (e) => e.code === code);
  await db.exec(`reset role;delete from ${table};set role authenticated;`);
}
await db.exec("reset role;set role anon;");
await assert.rejects(remove());
await db.exec(`reset role;create role service_role;
alter table organization_subscriptions add status text default 'active';
alter table integrations add status text default 'connected', add error_code text;
alter table integration_connect_attempts add status text default 'pending';
alter table communication_integrations add status text default 'active', add encrypted_credentials text;
alter table phone_integrations add status text default 'active', add encrypted_credentials text default '';
alter table storage.objects add bucket_id text default 'process-media';`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260914040000_automatic_workspace_cleanup.sql",
    "utf8",
  ),
);
await actor(member);
await assert.rejects(
  db.query("select authorize_workspace_deletion($1,$2)", [org, "Example"]),
);
await assert.rejects(remove());
await actor(owner);
await db.query("select authorize_workspace_deletion($1,$2)", [org, "Example"]);
await assert.rejects(db.query("select workspace_deletion_files($1)", [other]));
await db.exec(`reset role;
insert into integrations(organization_id,status) values('${org}','disconnected');
insert into integration_connect_attempts(organization_id,status) values('${org}','cancelled');
insert into organization_subscriptions values('${org}','cus_example','sub_example','canceled');
insert into communication_integrations values('${org}','disconnected',null);
insert into phone_integrations values('${org}','disconnected','');
set role authenticated;`);
await actor(owner);
await remove();
await assert.rejects(remove());
await db.exec("reset role;");
assert.equal((await db.query("select * from organizations")).rows.length, 1);
assert.equal(
  (await db.query("select * from knowledge")).rows[0].content,
  "Other rule",
);
assert.equal(
  (await db.query("select * from organization_members")).rows.length,
  0,
);
await db.close();
console.log(
  "PASS actual deletion RPC: owner-only, cross-tenant denial, typed confirmation, recent auth, every cleanup blocker, anonymous denial, cascade, repeat denial and preservation of another workspace (isolated PostgreSQL).",
);
console.log(
  "PASS latest deletion: preflight owner validation; private storage manifest; cancelled connection attempts, disconnected history and cancelled billing no longer block deletion.",
);
