import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Exercises the actual decision migration in isolated PostgreSQL. The vector
// column is replaced with real[]: this tests transactions, not vector indexing.
if (!process.env.OPRYN_PGLITE_MODULE)
  throw new Error("Set OPRYN_PGLITE_MODULE to an installed PGlite module.");
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [org, otherOrg, owner, employee, otherOwner, processId, role, rule] = [
  1, 2, 3, 4, 5, 6, 7, 8,
].map(id);
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('test.role',true) $$;
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create table processes(id uuid primary key,organization_id uuid);
create table process_role_assignments(process_id uuid,organization_id uuid,role_id uuid);
create table process_rules(id uuid primary key,organization_id uuid,title text,text text,status text,approved_by uuid,approved_at timestamptz);
create table knowledge_chunks(id uuid primary key default gen_random_uuid(),organization_id uuid,role_id uuid,content text,embedding real[],approved boolean,health_status text,criticality text,current_version integer,last_confirmed_at timestamptz,process_id uuid,rule_id uuid,source_type text,source_id uuid);
create table knowledge_versions(organization_id uuid,knowledge_chunk_id uuid,version_number integer,title text,content text,changed_by uuid,change_reason text,unique(knowledge_chunk_id,version_number));
create table knowledge_conflicts(organization_id uuid,knowledge_chunk_a uuid,knowledge_chunk_b uuid,status text,conflict_type text);
create table knowledge_events(organization_id uuid,event_type text,actor_id uuid,knowledge_chunk_id uuid,source_type text,source_id uuid,metadata jsonb,created_at timestamptz default now());
create table notifications(organization_id uuid,entity_type text,entity_id uuid,read boolean default false);
create table knowledge_proposals(id uuid primary key,organization_id uuid,title text,proposed_content text,risk_level text default 'normal',review_reason text,existing_knowledge_id uuid,version integer default 1,updated_at timestamptz default now(),status text default 'pending_approval',source_type text default 'chatgpt',related_process_id uuid,process_rule_id uuid,approved_by uuid,approved_at timestamptz,approved_knowledge_id uuid,rejected_by uuid,rejected_at timestamptz,rejection_reason text);
`);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260909001000_proposal_revision_decisions.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/extensions\.vector(?:\(1536\))?/g, "real[]");
await db.exec(migration);
await db.query(
  "insert into organization_members values($1,$3,'owner'),($1,$4,'employee'),($2,$5,'owner')",
  [org, otherOrg, owner, employee, otherOwner],
);
await db.query("insert into process_role_assignments values($1,$2,$3)", [
  processId,
  org,
  role,
]);
await db.query("insert into processes values($1,$2)", [processId, org]);
await db.query(
  "insert into process_rules values($1,$2,'Revision limits','Two revision rounds.','draft',null,null)",
  [rule, org],
);
async function auth(user = owner, authority = "authenticated") {
  await db.query(
    "select set_config('test.user',$1,false),set_config('test.role',$2,false)",
    [user, authority],
  );
}
async function scalar(sql, args = []) {
  return (await db.query(sql, args)).rows[0].value;
}
async function proposal(n, options = {}) {
  await db.query(
    "insert into knowledge_proposals(id,organization_id,title,proposed_content,related_process_id,process_rule_id,existing_knowledge_id,status) values($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      id(n),
      options.org ?? org,
      "Revision limits",
      options.content ?? "Two revision rounds.",
      options.process ?? null,
      options.rule ?? null,
      options.knowledge ?? null,
      options.status ?? "pending_approval",
    ],
  );
  return (
    await db.query(
      "select *,updated_at::text stamp from knowledge_proposals where id=$1",
      [id(n)],
    )
  ).rows[0];
}
const decide = (p, decision = "approved", overrides = {}) =>
  db.query(
    "select decide_knowledge_proposal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value",
    [
      overrides.org ?? p.organization_id,
      p.id,
      overrides.actor ?? owner,
      overrides.version ?? p.version,
      overrides.stamp ?? p.stamp,
      decision,
      "web",
      overrides.embedding === null ? null : [0.1, 0.2],
      null,
      overrides.knowledgeVersion ?? null,
    ],
  );
await auth();
const p = await proposal(10, { process: processId, rule });
await db.query(
  "insert into notifications(organization_id,entity_type,entity_id) values($1,'knowledge_proposal',$2)",
  [org, p.id],
);
const accepted = (await decide(p)).rows[0].value;
assert.equal(accepted.status, "approved");
assert.equal(
  await scalar("select role_id value from knowledge_chunks where id=$1", [
    accepted.knowledgeId,
  ]),
  role,
  "Restricted process access preserved",
);
assert.equal(
  await scalar("select status value from process_rules where id=$1", [rule]),
  "approved",
);
assert.equal(
  await scalar("select read value from notifications where entity_id=$1", [
    p.id,
  ]),
  true,
);
assert.equal(
  await scalar("select count(*)::int value from knowledge_versions"),
  1,
);
await assert.rejects(() => decide(p), /already resolved/);
assert.equal(
  await scalar("select count(*)::int value from knowledge_chunks"),
  1,
  "Retry must not duplicate knowledge",
);
const stale = await proposal(11);
await db.query(
  "update knowledge_proposals set proposed_content='Three revision rounds.' where id=$1",
  [stale.id],
);
assert.equal(
  await scalar("select version value from knowledge_proposals where id=$1", [
    stale.id,
  ]),
  2,
);
await assert.rejects(() => decide(stale), /changed/);
const pending = await proposal(12);
await auth(employee);
await assert.rejects(
  () => decide(pending, "approved", { actor: employee }),
  /Owner or admin/,
);
await assert.rejects(() => decide(pending), /Authentication required/);
await auth(otherOwner);
await assert.rejects(
  () => decide(pending, "approved", { actor: otherOwner }),
  /Owner or admin/,
);
await auth();
const foreign = await proposal(13, { org: otherOrg });
await assert.rejects(() => decide(foreign, "approved", { org }), /not found/);
await assert.rejects(
  () => decide(pending, "approved", { embedding: null }),
  /review/,
);
const critical = await proposal(14, { status: "needs_review" });
await assert.rejects(() => decide(critical), /review/);
await decide(pending, "rejected");
assert.equal(
  await scalar("select status value from knowledge_proposals where id=$1", [
    pending.id,
  ]),
  "rejected",
);
assert.equal(
  await scalar(
    "select count(*)::int value from knowledge_events where event_type='proposal_rejected'",
  ),
  1,
);
assert.equal(
  await scalar("select count(*)::int value from knowledge_chunks"),
  1,
);
const answerOnly = await proposal(15);
await decide(answerOnly, "answer_only");
assert.equal(
  await scalar("select status value from knowledge_proposals where id=$1", [
    answerOnly.id,
  ]),
  "answer_only",
);
const update = await proposal(16, {
  knowledge: accepted.knowledgeId,
  content: "Three revision rounds.",
});
await assert.rejects(() => decide(update), /Existing knowledge changed/);
await decide(update, "approved", { knowledgeVersion: 1 });
assert.equal(
  await scalar(
    "select current_version value from knowledge_chunks where id=$1",
    [accepted.knowledgeId],
  ),
  2,
);
assert.equal(
  await scalar(
    "select content value from knowledge_versions where knowledge_chunk_id=$1 and version_number=1",
    [accepted.knowledgeId],
  ),
  "Revision limits: Two revision rounds.",
);
const conflicting = await proposal(17, { knowledge: accepted.knowledgeId });
await db.query(
  "insert into knowledge_conflicts values($1,$2,null,'open','conflict')",
  [org, accepted.knowledgeId],
);
await assert.rejects(
  () => decide(conflicting, "approved", { knowledgeVersion: 2 }),
  /Resolve the knowledge conflict/,
);
const atomic = await proposal(18);
await db.exec(
  "create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Simulated audit failure'; end; $$; create trigger test_failure before insert on knowledge_events for each row execute function fail_audit();",
);
const beforeCount = await scalar(
  "select count(*)::int value from knowledge_chunks",
);
await assert.rejects(() => decide(atomic), /Simulated audit failure/);
assert.equal(
  await scalar("select status value from knowledge_proposals where id=$1", [
    atomic.id,
  ]),
  "pending_approval",
  "Audit failure rolls back approval",
);
assert.equal(
  await scalar("select count(*)::int value from knowledge_chunks"),
  beforeCount,
  "Audit failure rolls back indexing too",
);
await db.exec("drop trigger test_failure on knowledge_events");
const parallel = await proposal(19);
const results = await Promise.allSettled([decide(parallel), decide(parallel)]);
assert.equal(
  results.filter((r) => r.status === "fulfilled").length,
  1,
  "Only one reviewer succeeds",
);
assert.equal(
  await scalar(
    "select has_function_privilege('anon','public.decide_knowledge_proposal(uuid,uuid,uuid,integer,timestamptz,text,text,real[],text,integer)','EXECUTE') value",
  ),
  false,
);
await db.query(
  "insert into knowledge_events(organization_id,event_type,actor_id) select $1,'proposal_approved',$2 from generate_series(1,30)",
  [org, owner],
);
await assert.rejects(() => decide(atomic), /Too many decisions/);
await db.close();
console.log(
  "Passed isolated PostgreSQL: exact revision, replay, concurrent calls, org/role checks, restricted process scope, audit rollback, history, denial, answer-only, conflict and write-rate checks. Not live pgvector or Supabase verification.",
);
