// Execute the actual additive migration in isolated PostgreSQL; never connects to Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
assert.ok(process.env.OPRYN_PGLITE_MODULE, "Set OPRYN_PGLITE_MODULE");
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create table knowledge_proposals(id uuid primary key default gen_random_uuid(),organization_id uuid,proposal_type text,title text,proposed_content text,source_type text,source_label text,source_id uuid,risk_level text,status text,content_hash text,created_by uuid);
create table external_ai_escalations(id uuid primary key,organization_id uuid,connection_id uuid,question text,status text,resolution text,proposed_rule text,resolved_at timestamptz);
create table knowledge_events(organization_id uuid,event_type text,actor_id uuid,source_type text,source_id uuid,metadata jsonb);
create table notifications(organization_id uuid,user_id uuid,type text,title text,body text,link text,entity_type text,entity_id uuid,action text,target_url text);
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916015000_external_answer_proposals.sql",
    "utf8",
  ),
);
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002";
const conn = "30000000-0000-4000-8000-000000000001",
  wrongConn = "30000000-0000-4000-8000-000000000002";
const e = "40000000-0000-4000-8000-000000000001",
  e2 = "40000000-0000-4000-8000-000000000002",
  e3 = "40000000-0000-4000-8000-000000000003";
await db.query(
  "insert into organization_members values($1,$2,'owner'),($1,$3,'member'),($4,$2,'owner')",
  [org, owner, member, other],
);
await db.query(
  "insert into external_ai_escalations(id,organization_id,connection_id,question,status) values($1,$4,$5,'Refund limit?','open'),($2,$4,$5,'Exception?','open'),($3,$4,$5,'Rollback?','open')",
  [e, e2, e3, org, conn],
);
const actor = (id) =>
  db.exec(`set role authenticated; set test.actor='${id}';`);
const submit = async (
  action = "request_approval",
  exception = false,
  escalation = e,
  workspace = org,
  connection = conn,
) =>
  (
    await db.query(
      "select submit_external_human_answer($1,$2,$3,$4,'Owner approval above $500','Owner approval above $500',$5) result",
      [workspace, connection, escalation, action, exception],
    )
  ).rows[0].result;
await actor(member);
await assert.rejects(submit(), (error) => error.code === "42501");
await actor(owner);
await assert.rejects(
  submit("request_approval", false, e, other),
  (error) => error.code === "P0002",
);
await assert.rejects(
  submit("request_approval", false, e, org, wrongConn),
  (error) => error.code === "P0002",
);
await assert.rejects(
  submit("request_approval", true),
  (error) => error.code === "23514",
);
const saved = await submit();
assert.equal(saved.awaitingApproval, true);
assert.equal(saved.learned, false);
assert.deepEqual(await submit(), saved);
await assert.rejects(submit("answer_only"), (error) => error.code === "40001");
await db.exec("reset role");
const proposal = (await db.query("select * from knowledge_proposals")).rows[0];
assert.equal(proposal.status, "pending_approval");
assert.equal(proposal.source_id, e);
assert.equal(proposal.source_type, "owner_answer");
assert.equal(proposal.risk_level, "critical");
assert.equal(
  (await db.query("select count(*)::int n from knowledge_proposals")).rows[0].n,
  1,
);
await actor(owner);
const once = await submit("answer_only", true, e2);
assert.equal(once.awaitingApproval, false);
await assert.rejects(
  submit("request_approval", false, e2),
  (error) => error.code === "40001",
);
await db.exec(`reset role;
create function fail_notification() returns trigger language plpgsql as $$begin raise exception 'Fixture failure'; end;$$;
create trigger fail_notification before insert on notifications for each row execute function fail_notification();`);
await actor(owner);
await assert.rejects(submit("request_approval", false, e3));
await db.exec("reset role");
assert.equal(
  (
    await db.query("select status from external_ai_escalations where id=$1", [
      e3,
    ])
  ).rows[0].status,
  "open",
);
assert.equal(
  (await db.query("select count(*)::int n from knowledge_proposals")).rows[0].n,
  1,
);
await db.exec("drop trigger fail_notification on notifications");
await actor(owner);
assert.equal((await submit("dismiss", false, e3)).awaitingApproval, false);
await assert.rejects(
  submit("answer_only", false, e3),
  (error) => error.code === "40001",
);
await db.exec("reset role");
const route = readFileSync(
  "app/api/ai-connections/[id]/escalations/[escalationId]/answer/route.ts",
  "utf8",
);
assert.ok(route.includes("getExternalAIAnswerContext"));
assert.ok(route.includes("assigned_to") && route.includes("403"));
assert.ok(
  !route.includes('.from("knowledge_chunks")') &&
    !route.includes('.from("question_clusters")'),
);
await db.close();
console.log(
  "PASS: external pending-only proposals, tenant/connection isolation, exception safety, idempotency, atomic rollback and dismissal. Route retains billing/assignment gate; no direct publication or blind gap closure.",
);
