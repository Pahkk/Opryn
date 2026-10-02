// Executes the real additive migration in isolated PostgreSQL; never connects remotely.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role; create schema auth;
create function auth.role() returns text language sql stable as $$select current_setting('test.jwt_role',true)$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table organizations(id uuid primary key);
create table organization_members(organization_id uuid,user_id uuid,permission_level text,role_id uuid);
create table organization_settings(organization_id uuid,employees_can_ask boolean);
create function is_org_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in ('owner','admin'))$$;
create table question_clusters(id uuid primary key,organization_id uuid,status text default 'open',resolved_by_knowledge_id uuid,updated_at timestamptz,question_count integer default 2);
create table employee_questions(id uuid primary key,organization_id uuid,cluster_id uuid,question text,asked_by uuid);
create table knowledge_chunks(id uuid primary key,organization_id uuid,approved boolean,health_status text,current_version integer,role_id uuid);
create table knowledge_proposals(id uuid primary key,organization_id uuid,status text,related_question_id uuid,approved_knowledge_id uuid);
create function knowledge_context_requires_review(org uuid,ids uuid[]) returns boolean language sql stable as $$select exists(select 1 from public.knowledge_chunks where organization_id=org and id=any(ids) and health_status <> 'healthy')$$;
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916013000_gap_answer_rechecks.sql",
    "utf8",
  ),
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [org, other, cluster, q1, q2, p, k, foreign, owner] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
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
  "insert into employee_questions values($1,$3,$4,'Refund limit?',$5),($2,$3,$4,'Approve $700?',$5)",
  [q1, q2, org, cluster, owner],
);
await db.query(
  "insert into knowledge_chunks values($1,$3,true,'healthy',1,null),($2,$4,true,'healthy',1,null)",
  [k, foreign, org, other],
);
await db.query(
  "insert into knowledge_proposals values($1,$2,'pending_approval',$3,null)",
  [p, org, q1],
);
assert.equal(
  (await db.query("select * from knowledge_gap_rechecks")).rows.length,
  0,
);
await db.query(
  "update knowledge_proposals set status='approved',approved_knowledge_id=$2 where id=$1",
  [p, k],
);
assert.equal(
  (await db.query("select * from knowledge_gap_rechecks")).rows.length,
  2,
);
await db.query("update knowledge_proposals set status='approved' where id=$1", [
  p,
]);
assert.equal(
  (await db.query("select * from knowledge_gap_rechecks")).rows.length,
  2,
);
const finish = async (
  question,
  status = "answered",
  citations = [k],
  version = 1,
  workspace = org,
) =>
  (
    await db.query(
      "select complete_knowledge_gap_recheck($1,$2,$3,$4,$5,$6,$7) closed",
      [
        workspace,
        p,
        question,
        status,
        status === "answered" ? "Owner approval above $500." : "",
        citations,
        version,
      ],
    )
  ).rows[0].closed;
await db.exec("set test.jwt_role='authenticated'");
await assert.rejects(finish(q1), (e) => e.code === "42501");
await db.exec("set test.jwt_role='service_role'");
const claim = async (workspace = org) =>
  (
    await db.query("select * from claim_knowledge_gap_rechecks($1,$2)", [
      workspace,
      p,
    ])
  ).rows;
assert.equal((await claim()).length, 2);
assert.equal(
  (await claim()).length,
  0,
  "parallel/duplicate attempts cannot claim the same model work",
);
assert.equal((await claim(other)).length, 0);
await db.exec(
  "update knowledge_gap_rechecks set last_attempt_at=now()-interval '6 minutes'",
);
assert.equal(
  (await claim()).length,
  2,
  "interrupted work is retryable after its lease expires",
);
await db.query(
  "update organization_members set permission_level='member',role_id=$1 where user_id=$2",
  [id(50), owner],
);
await db.query("update knowledge_chunks set role_id=$1 where id=$2", [
  id(51),
  k,
]);
await assert.rejects(
  finish(q1),
  (e) => e.code === "23514",
  "permission changes are enforced again at commit",
);
await db.query(
  "update organization_members set permission_level='owner',role_id=null where user_id=$1",
  [owner],
);
await db.query("insert into organization_settings values($1,false)", [org]);
await assert.rejects(finish(q1), (e) => e.code === "23514");
await db.exec("update organization_settings set employees_can_ask=true");
await assert.rejects(
  finish(q1, "answered", [foreign]),
  (e) => e.code === "23514",
);
await assert.rejects(finish(q1, "answered", [k], 2), (e) => e.code === "23514");
await assert.rejects(
  finish(q1, "answered", [k], 1, other),
  (e) => e.code === "P0002",
);
assert.equal(
  await finish(q1),
  false,
  "one successful variant cannot resolve the cluster",
);
assert.equal(await finish(q2, "unknown"), false);
assert.equal(await finish(q2, "error"), false);
assert.equal(await finish(q2), true);
await db.exec("update question_clusters set question_count=3");
assert.equal(
  await finish(q2),
  false,
  "unrecorded/external occurrences cannot be certified by team questions",
);
await db.exec("update question_clusters set question_count=2");
assert.equal(await finish(q2), true);
assert.equal(
  (
    await db.query(
      "select status,resolved_by_knowledge_id from question_clusters",
    )
  ).rows[0].resolved_by_knowledge_id,
  k,
);
assert.equal(await finish(q2, "unknown"), false);
assert.equal(
  (await db.query("select status from question_clusters")).rows[0].status,
  "open",
);
assert.equal(await finish(q2), true);
// New questions and new versions invalidate closure, not approved history.
await db.exec(
  "update question_clusters set status='open'; update knowledge_chunks set current_version=2;",
);
assert.equal(await finish(q2, "answered", [k], 2), false);
assert.equal(await finish(q1, "answered", [k], 2), true);
await db.exec("update question_clusters set status='dismissed';");
assert.equal(await finish(q1, "answered", [k], 2), false);
await db.exec("update question_clusters set status='open';");
await db.query(
  "insert into employee_questions values($1,$2,$3,'Another variant',$4)",
  [id(10), org, cluster, owner],
);
assert.equal(await finish(q1, "answered", [k], 2), false);
await db.exec("update knowledge_chunks set health_status='conflict';");
await assert.rejects(finish(q1, "answered", [k], 2), (e) => e.code === "23514");
await db.exec(`set test.actor='${owner}'; set role authenticated;`);
assert.equal(
  (await db.query("select * from knowledge_gap_rechecks")).rows.length,
  2,
);
await assert.rejects(
  db.exec("update knowledge_gap_rechecks set status='answered'"),
  (e) => e.code === "42501",
);
await db.exec(`set test.actor='${id(11)}';`);
assert.equal(
  (await db.query("select * from knowledge_gap_rechecks")).rows.length,
  0,
);
await db.exec(`reset role;
alter table employee_questions add column status text,add column escalated boolean default false,add column assigned_expert_id uuid;
create table notifications(organization_id uuid,user_id uuid,type text,title text,body text,link text,entity_type text,entity_id uuid,action text,target_url text,read boolean default false,created_at timestamptz default now());
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916014000_gap_notification_dedup.sql",
    "utf8",
  ),
);
await db.exec(
  "create trigger notify_question after insert or update on employee_questions for each row execute function notify_owners_of_question();",
);
const routedQuestion = async (n, escalated = true, assignee = null) =>
  db.query(
    "insert into employee_questions(id,organization_id,cluster_id,question,asked_by,status,escalated,assigned_expert_id) values($1,$2,$3,'Refund?',$4,'needs_owner',$5,$6)",
    [id(n), org, cluster, owner, escalated, assignee],
  );
const notificationCount = async () =>
  (await db.query("select count(*)::int n from notifications")).rows[0].n;
await routedQuestion(20);
await routedQuestion(21);
assert.equal(
  await notificationCount(),
  1,
  "same cluster/recipient unread requests deduplicate",
);
await routedQuestion(22, false);
assert.equal(
  await notificationCount(),
  1,
  "disabled escalation does not notify",
);
await db.exec("update notifications set read=true");
await routedQuestion(23);
assert.equal(
  await notificationCount(),
  2,
  "a read request permits a new meaningful alert",
);
await db.query("insert into organization_members values($1,$2,'member',null)", [
  org,
  id(30),
]);
await routedQuestion(24, true, id(30));
assert.equal(
  await notificationCount(),
  3,
  "expert routing does not interrupt the owner",
);
await db.query("update employee_questions set escalated=true where id=$1", [
  id(24),
]);
assert.equal(await notificationCount(), 3, "retries do not notify again");
await db.close();
console.log(
  "PASS: durable approval queue, variant completeness, unknown/error safety, current versions, conflict gate, organization isolation and admin-only RLS",
);
