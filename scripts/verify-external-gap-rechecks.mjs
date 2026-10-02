// Actual migrations in isolated PostgreSQL. No remote database/model/provider access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
assert.ok(process.env.OPRYN_PGLITE_MODULE, "Set OPRYN_PGLITE_MODULE");
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
const baseFixture = readFileSync(
  "scripts/verify-gap-rechecks.mjs",
  "utf8",
).match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
await db.exec(baseFixture);
await db.exec(`
alter table knowledge_chunks add column source_type text default 'owner_answer',add column source_id uuid,add column process_id uuid,add column rule_id uuid,add column library_archived_at timestamptz;
alter table knowledge_proposals add column source_type text,add column source_id uuid;
create table external_ai_connections(id uuid primary key,organization_id uuid,status text,knowledge_mode text);
create table external_ai_api_keys(id uuid primary key,connection_id uuid,organization_id uuid,revoked_at timestamptz);
create table external_ai_escalations(id uuid primary key,organization_id uuid,connection_id uuid,cluster_id uuid);
create table external_ai_scopes(connection_id uuid,organization_id uuid,scope text);
create table external_ai_knowledge_access(connection_id uuid,organization_id uuid,source_type text,source_id uuid);
create table organization_subscriptions(organization_id uuid,plan text,status text,stripe_subscription_id text);
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916013000_gap_answer_rechecks.sql",
    "utf8",
  ),
);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916020000_external_gap_rechecks.sql",
    "utf8",
  ),
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [org, other, cluster, q, p, k, owner, conn, key, e] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
].map(id);
await db.query("insert into organizations values($1),($2)", [org, other]);
await db.query("insert into organization_members values($1,$2,'owner',null)", [
  org,
  owner,
]);
await db.query(
  "insert into question_clusters(id,organization_id) values($1,$2)",
  [cluster, org],
);
await db.query(
  "insert into employee_questions values($1,$2,$3,'Refund limit?',$4)",
  [q, org, cluster, owner],
);
await db.query(
  "insert into knowledge_chunks(id,organization_id,approved,health_status,current_version) values($1,$2,true,'healthy',1)",
  [k, org],
);
await db.query(
  "insert into external_ai_connections values($1,$2,'active','all_approved')",
  [conn, org],
);
await db.query("insert into external_ai_api_keys values($1,$2,$3,null)", [
  key,
  conn,
  org,
]);
await db.query(
  "insert into organization_subscriptions values($1,'premium','active','sub_fixture')",
  [org],
);
await db.query(
  "insert into external_ai_escalations(id,organization_id,connection_id,cluster_id,origin_api_key_id) values($1,$2,$3,$4,$5)",
  [e, org, conn, cluster, key],
);
await db.query(
  "insert into external_ai_scopes values($1,$2,'knowledge:read'),($1,$2,'policies:read')",
  [conn, org],
);
await db.query(
  "insert into knowledge_proposals(id,organization_id,status,approved_knowledge_id,source_type,source_id) values($1,$2,'pending_approval',$3,'owner_answer',$4)",
  [p, org, k, e],
);
await db.query("update knowledge_proposals set status='approved' where id=$1", [
  p,
]);
assert.equal(
  (await db.query("select count(*)::int n from knowledge_gap_rechecks")).rows[0]
    .n,
  2,
);
await db.exec("set test.jwt_role='authenticated'");
await assert.rejects(
  db.query("select * from claim_external_gap_rechecks($1,$2)", [org, p]),
  (error) => error.code === "42501",
);
await db.exec("set test.jwt_role='service_role'");
assert.equal(
  (
    await db.query("select * from claim_knowledge_gap_rechecks($1,$2)", [
      org,
      p,
    ])
  ).rows[0].question_id,
  q,
);
assert.equal(
  (await db.query("select * from claim_external_gap_rechecks($1,$2)", [org, p]))
    .rows[0].external_escalation_id,
  e,
);
assert.equal(
  (await db.query("select * from claim_external_gap_rechecks($1,$2)", [org, p]))
    .rows.length,
  0,
);
const team = () =>
  db.query(
    "select complete_knowledge_gap_recheck($1,$2,$3,'answered','Owner approval above $500',$4,1) closed",
    [org, p, q, [k]],
  );
const external = (status = "answered", workspace = org) =>
  db.query("select complete_external_gap_recheck($1,$2,$3,$4,$5,$6,1) closed", [
    workspace,
    p,
    e,
    status,
    "Owner approval above $500",
    [k],
  ]);
assert.equal((await team()).rows[0].closed, false);
await assert.rejects(
  external("answered", other),
  (error) => error.code === "P0002",
);
await db.query("update external_ai_api_keys set revoked_at=now() where id=$1", [
  key,
]);
await assert.rejects(external(), (error) => error.code === "23514");
await db.query("update external_ai_api_keys set revoked_at=null where id=$1", [
  key,
]);
await db.query("delete from external_ai_scopes where scope='policies:read'");
await assert.rejects(external(), (error) => error.code === "23514");
await db.query("insert into external_ai_scopes values($1,$2,'policies:read')", [
  conn,
  org,
]);
await db.query(
  "update external_ai_connections set knowledge_mode='selected' where id=$1",
  [conn],
);
await assert.rejects(external(), (error) => error.code === "23514");
await db.query(
  "insert into external_ai_knowledge_access values($1,$2,'owner_answer',null)",
  [conn, org],
);
assert.equal((await external()).rows[0].closed, true);
assert.equal((await external("unknown")).rows[0].closed, false);
assert.equal(
  (
    await db.query("select status from question_clusters where id=$1", [
      cluster,
    ])
  ).rows[0].status,
  "open",
);
await db.query("update knowledge_chunks set current_version=2 where id=$1", [
  k,
]);
await assert.rejects(external(), (error) => error.code === "23514");
await db.query("update knowledge_chunks set current_version=1 where id=$1", [
  k,
]);
await db.query("update organization_subscriptions set status='canceled'");
await assert.rejects(external(), (error) => error.code === "23514");
await db.query("update organization_subscriptions set status='active'");
await db.query("update question_clusters set question_count=3 where id=$1", [
  cluster,
]);
assert.equal((await external()).rows[0].closed, false); // Unrecorded real occurrence is not fabricated proof.
await db.query(
  "update knowledge_gap_rechecks set status='error',last_attempt_at=now()-interval '1 hour',attempt_count=3",
);
assert.equal(
  (await db.query("select * from list_due_gap_recheck_batches()")).rows.length,
  0,
);
await db.query("update knowledge_gap_rechecks set attempt_count=1");
assert.equal(
  (await db.query("select * from list_due_gap_recheck_batches()")).rows.length,
  1,
);
assert.equal(
  (
    await db.query(
      "select has_function_privilege('authenticated','claim_external_gap_rechecks(uuid,uuid)','execute') allowed",
    )
  ).rows[0].allowed,
  false,
);
await db.close();
console.log(
  "PASS real unified queue: mixed-channel closure, revoked key/scope/access/billing/version safety, tenant isolation, cooldown and bounded scheduled retries.",
);
