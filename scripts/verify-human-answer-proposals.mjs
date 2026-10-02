// Isolated PostgreSQL. No production database, provider, or model calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const modulePath = process.env.OPRYN_PGLITE_MODULE;
assert.ok(
  modulePath,
  "Set OPRYN_PGLITE_MODULE to an installed PGlite dist/index.js",
);
const { PGlite } = await import(pathToFileURL(modulePath));
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create table employee_questions(id uuid primary key,organization_id uuid,asked_by uuid,assigned_expert_id uuid,status text,question text,resolved_at timestamptz);
create table question_answers(id uuid primary key,organization_id uuid,question_id uuid,answer_type text,answered_by uuid,proposed_rule text);
create table knowledge_proposals(id uuid primary key default gen_random_uuid(),organization_id uuid,proposal_type text,title text,proposed_content text,source_type text,source_label text,source_id uuid,related_question_id uuid,risk_level text,status text,content_hash text,created_by uuid);
create table knowledge_events(organization_id uuid,event_type text,actor_id uuid,question_id uuid,source_type text,source_id uuid,metadata jsonb);
create table notifications(organization_id uuid,user_id uuid,type text,title text,body text,link text,entity_type text,entity_id uuid,action text,target_url text);
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916010000_human_answer_proposals.sql",
    "utf8",
  ),
);
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const owner = "20000000-0000-4000-8000-000000000001",
  expert = "20000000-0000-4000-8000-000000000002",
  stranger = "20000000-0000-4000-8000-000000000003";
const q = "30000000-0000-4000-8000-000000000001",
  a = "40000000-0000-4000-8000-000000000001";
await db.query(
  "insert into organization_members values($1,$2,'owner'),($1,$3,'member'),($4,$5,'owner')",
  [org, owner, expert, other, stranger],
);
await db.query(
  "insert into employee_questions values($1,$2,$3,$4,'needs_owner','Can managers refund?',null)",
  [q, org, owner, expert],
);
await db.query(
  "insert into question_answers(id,organization_id,question_id,answer_type,answered_by,proposed_rule) values($1,$2,$3,'expert',$4,'Managers may approve up to $500')",
  [a, org, q, expert],
);
const actor = async (id) =>
  db.exec(`set role authenticated; set test.actor='${id}';`);
const submit = async (
  action = "request_approval",
  exception = false,
  workspace = org,
) =>
  (
    await db.query(
      "select submit_human_answer($1,$2,$3,$4,'Refund limits','Managers may approve up to $500',$5) result",
      [workspace, q, a, action, exception],
    )
  ).rows[0].result;
const count = async (table) =>
  (await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
await actor(stranger);
await assert.rejects(submit(), (e) => e.code === "42501");
await assert.rejects(
  submit("request_approval", false, other),
  (e) => e.code === "P0002",
);
await actor(expert);
await assert.rejects(
  submit("request_approval", true),
  (e) => e.code === "23514",
);
// Notification failure must roll back proposal, answer intent and question resolution.
await db.exec(
  "reset role; alter table notifications add constraint reject_notifications check(false); set role authenticated;",
);
await assert.rejects(submit(), (e) => e.code === "23514");
await db.exec(
  "reset role; alter table notifications drop constraint reject_notifications;",
);
assert.equal(await count("knowledge_proposals"), 0);
assert.equal(
  (await db.query("select status from employee_questions")).rows[0].status,
  "needs_owner",
);
await actor(expert);
const first = await submit();
assert.equal(first.awaitingApproval, true);
assert.equal(first.learned, false);
const retry = await submit();
assert.equal(retry.proposalId, first.proposalId);
await assert.rejects(submit("answer_only"), (e) => e.code === "40001");
await db.exec("reset role;");
assert.equal(await count("knowledge_proposals"), 1);
assert.equal(await count("knowledge_events"), 1);
assert.equal(await count("notifications"), 2);
const proposal = (await db.query("select * from knowledge_proposals")).rows[0];
assert.equal(proposal.status, "pending_approval");
assert.equal(proposal.related_question_id, q);
assert.equal(proposal.source_id, a);
assert.equal(proposal.created_by, expert);
await db.exec(
  "delete from notifications; delete from knowledge_events; delete from question_answers; delete from knowledge_proposals; update employee_questions set status='needs_owner';",
);
await db.query(
  "insert into question_answers(id,organization_id,question_id,answer_type,answered_by,proposed_rule,is_one_time_exception) values($1,$2,$3,'expert',$4,'For this customer only, refund $800',true)",
  [a, org, q, expert],
);
await actor(expert);
// Cannot bypass the saved one-time intent by sending false from the browser.
await assert.rejects(submit(), (e) => e.code === "23514");
const once = await submit("answer_only");
assert.equal(once.awaitingApproval, false);
await submit("answer_only");
await db.exec("reset role;");
assert.equal(await count("knowledge_proposals"), 0);
assert.equal(await count("notifications"), 1);
assert.equal(
  (await db.query("select reusable_intent,proposed_rule from question_answers"))
    .rows[0].reusable_intent,
  "one_time_exception",
);
await actor("");
await assert.rejects(submit(), (e) => e.code === "42501");
await db.exec(`reset role;
create table knowledge_chunks(id uuid primary key);
create table question_clusters(id uuid primary key,organization_id uuid,topic text,representative_question text,question_count integer,created_at timestamptz default now(),updated_at timestamptz default now(),status text default 'open');
alter table employee_questions add column cluster_id uuid,add column origin text default 'employee',add column escalated boolean default false,add column created_at timestamptz default now();
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916011000_knowledge_gap_projection.sql",
    "utf8",
  ),
);
await db.query(
  "insert into question_clusters(id,organization_id,topic,representative_question,question_count) values($1,$2,'Refund limits','  Refund   limits?  ',2),($3,$4,'Private','Private question',1)",
  [q, org, a, other],
);
await db.query("update employee_questions set cluster_id=$1", [q]);
for (const table of [
  "question_clusters",
  "employee_questions",
  "question_answers",
  "knowledge_proposals",
]) {
  await db.exec(`alter table ${table} enable row level security;
    create policy tenant_admin on ${table} to authenticated using (organization_id in
      (select m.organization_id from organization_members m where m.user_id=auth.uid() and m.permission_level in ('owner','admin')));`);
}
await db.exec(
  "grant select on all tables in schema public to authenticated; grant usage on schema auth to authenticated;",
);
await actor(owner);
const gap = async () =>
  (await db.query("select * from company_knowledge_gaps")).rows;
assert.equal((await gap()).length, 1);
assert.equal((await gap())[0].status, "answered");
assert.equal((await gap())[0].normalized_question, "refund limits?");
await db.exec("reset role; delete from question_answers;");
await actor(owner);
assert.equal((await gap())[0].status, "open");
await db.exec(
  "reset role; update employee_questions set status='needs_owner',escalated=true;",
);
await actor(owner);
assert.equal((await gap())[0].status, "routed");
await db.exec("reset role;");
await db.query(
  "insert into knowledge_proposals(organization_id,title,related_question_id,status) values($1,'Refund limits',$2,'pending_approval')",
  [org, q],
);
await actor(owner);
assert.equal((await gap())[0].status, "proposed");
for (const state of ["resolved", "dismissed"]) {
  await db.exec(
    `reset role; update question_clusters set status='${state}' where organization_id='${org}';`,
  );
  await actor(owner);
  assert.equal((await gap())[0].status, state);
}
await actor(stranger);
assert.equal((await gap()).length, 1);
assert.equal((await gap())[0].organization_id, other);
await actor(expert);
assert.equal((await gap()).length, 0);
await db.exec(`reset role;
create role service_role;
create function auth.role() returns text language sql stable as $$select current_setting('role',true)$$;
create function public.is_org_member(org uuid) returns boolean language sql stable as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid())$$;
create function public.is_org_admin(org uuid) returns boolean language sql stable as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in ('owner','admin'))$$;
alter table organization_members add column role_id uuid;
alter table knowledge_chunks add column organization_id uuid,add column role_id uuid;
create table profiles(id uuid primary key,full_name text);
create table knowledge_experts(id uuid primary key,organization_id uuid,user_id uuid,knowledge_chunk_id uuid,category text,priority integer);
grant select on all tables in schema public to authenticated;
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916012000_expert_routing_specificity.sql",
    "utf8",
  ),
);
await db.query(
  "insert into profiles values($1,'Owner'),($2,'Refund expert'),($3,'Other owner')",
  [owner, expert, stranger],
);
await db.query(
  "insert into knowledge_experts values($1,$2,$3,null,'Refund',1),($4,$2,$5,null,'Refund approval',50),($6,$7,$8,null,'Refund approval limits',1)",
  [q, org, owner, a, expert, owner, other, stranger],
);
await actor(owner);
const route = async (workspace = org) =>
  (
    await db.query(
      "select * from find_company_knowledge_expert($1,'What are the refund approval limits?',null)",
      [workspace],
    )
  ).rows;
assert.equal((await route())[0].user_id, expert); // Specific area beats generic lower priority.
assert.equal(
  (
    await db.query(
      "select * from find_company_knowledge_expert($1,'What is the warranty?',null)",
      [org],
    )
  ).rows.length,
  0,
); // Caller uses owner/admin fallback, not a random expert.
await assert.rejects(route(other), (e) => e.code === "42501");
await db.close();
console.log(
  "PASS tenant isolation, assigned-expert authority, pending-only proposals, provenance, duplicate retry, exception safety, atomic rollback, six-state RLS gap projection and most-specific expert routing",
);
