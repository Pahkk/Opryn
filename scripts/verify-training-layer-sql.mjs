// Execute actual Phase 4/5 SQL in isolated PostgreSQL. Vector distance is mocked;
// this is not pgvector/auth/provider E2E and never connects to Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ||
      "/private/tmp/opryn-training-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create schema auth;create schema extensions;create domain extensions.vector as text;
create function extensions.distance(text,text) returns double precision language sql immutable as $$select 0::double precision$$;
create operator extensions.<=> (leftarg=text,rightarg=text,function=extensions.distance);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create type training_status as enum('assigned','started','completed');
create table profiles(id uuid primary key);
create table organizations(id uuid primary key);
create table roles(id uuid primary key,organization_id uuid references organizations, name text,unique(id,organization_id));
create table organization_members(organization_id uuid,user_id uuid,permission_level text,role_id uuid);
create function is_org_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in('owner','admin'))$$;
create function is_org_premium_admin(org uuid) returns boolean language sql stable as $$select public.is_org_admin(org) and coalesce(current_setting('test.premium',true),'true')<>'false'$$;
create function is_org_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid())$$;
create function set_updated_at() returns trigger language plpgsql as $$begin new.updated_at:=clock_timestamp();return new;end$$;
create table external_ai_connections(id uuid primary key,agent_id text,organization_id uuid,name text,provider text,description text,created_by uuid,last_used_at timestamptz,status text default 'active',knowledge_mode text default 'all_approved',updated_at timestamptz default now());
create trigger touch_connection before update on external_ai_connections for each row execute function set_updated_at();
create table external_ai_api_keys(id uuid primary key,organization_id uuid,connection_id uuid,revoked_at timestamptz);
create table external_ai_scopes(connection_id uuid,organization_id uuid,scope text);
create table external_ai_knowledge_access(connection_id uuid,organization_id uuid,source_type text,source_id uuid);
create table external_ai_activity(id uuid primary key default gen_random_uuid(),organization_id uuid,connection_id uuid,endpoint text,result_status text,created_at timestamptz default now());
create table knowledge_gap_rechecks(organization_id uuid,external_escalation_id uuid,status text,cited_knowledge_ids uuid[]);
create table knowledge_events(organization_id uuid,event_type text,actor_id uuid,source_type text,source_id uuid,metadata jsonb);
create table processes(id uuid primary key,organization_id uuid,title text,status text default 'approved',updated_at timestamptz default now(),library_archived_at timestamptz,unique(id,organization_id));
create table knowledge_chunks(id uuid primary key,organization_id uuid,content text,source_type text,source_id uuid,process_id uuid,rule_id uuid,role_id uuid,approved boolean default true,library_archived_at timestamptz,embedding extensions.vector default 'v',library_category text default 'policy',health_status text default 'healthy',criticality text default 'normal',usage_count integer default 0,last_confirmed_at timestamptz,created_at timestamptz default now());
create table knowledge_conflicts(id uuid,organization_id uuid,knowledge_chunk_a uuid,knowledge_chunk_b uuid,status text,conflict_type text,created_at timestamptz default now());
create table training_assignments(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,process_id uuid,status training_status default 'assigned',started_at timestamptz,completed_at timestamptz,unique(user_id,process_id));
create table organization_settings(organization_id uuid,estimated_interruption_minutes numeric);
create table employee_questions(id uuid primary key,organization_id uuid,asked_by uuid,question text,origin text,status text,answered_by_opryn boolean,escalated boolean,assigned_expert_id uuid,cluster_id uuid,created_at timestamptz default now());
create table external_ai_escalations(id uuid primary key,organization_id uuid,connection_id uuid,cluster_id uuid,status text,escalated boolean,assigned_to uuid,knowledge_proposal_id uuid,created_at timestamptz default now());
create table question_clusters(id uuid primary key,organization_id uuid,topic text,representative_question text,status text,updated_at timestamptz default now());
create table knowledge_feedback(organization_id uuid,question_id uuid,feedback_type text);
create table knowledge_proposals(id uuid,organization_id uuid,status text,related_question_id uuid,updated_at timestamptz default now());
create table integrations(id uuid primary key,organization_id uuid,status text);
create table integration_sources(id uuid primary key,organization_id uuid,integration_id uuid,provider text,title text,review_status text,process_id uuid,approved_process_id uuid,last_imported_at timestamptz);
create function record_external_gap(target_organization_id uuid,target_connection_id uuid,target_key_id uuid,question_text text,question_context text,question_embedding extensions.vector,route_question boolean,register_occurrence boolean default true,applicability_context jsonb default '{}') returns jsonb language sql as $$select jsonb_build_object('routed',route_question)$$;`);

await db.exec(`alter table knowledge_chunks add column current_version integer default 1,add column scope jsonb default '{}',add unique(id,organization_id);
alter table training_assignments add column created_at timestamptz default now();
alter table knowledge_feedback add column id uuid default gen_random_uuid(),add column knowledge_chunk_id uuid,add column user_id uuid,add column reason text,add column note text,add column status text default 'open';
create table knowledge_test_cases(id uuid primary key default gen_random_uuid(),organization_id uuid,title text,question text,context jsonb default '{}',consumer text,actor_id uuid,connection_id uuid,expected_outcome text,expected_knowledge_ids uuid[] default '{}',linked_knowledge_ids uuid[] default '{}',last_run_at timestamptz,last_result jsonb);
create table notifications(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,type text,title text,body text,link text,read boolean default false);
create function knowledge_scope_match(value jsonb,context jsonb) returns text language sql immutable as $$select case when value='{}' then 'matches' else 'needs_clarification' end$$;`);
for (const f of [
  "20260916050000_external_ai_policies",
  "20260916051000_role_learning",
  "20260929010000_company_training_layer",
])
  await db.exec(
    readFileSync(`supabase/migrations/${f}.sql`, "utf8").replaceAll(
      "extensions.vector(1536)",
      "extensions.vector",
    ),
  );
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  org,
  other,
  owner,
  member,
  outsider,
  role,
  otherRole,
  k,
  foreignK,
  connection,
  test,
] = Array.from({ length: 11 }, (_, i) => id(i + 1));
await db.exec(`insert into organizations values('${org}'),('${other}');insert into profiles values('${owner}'),('${member}'),('${outsider}');
insert into roles values('${role}','${org}','Support Rep'),('${otherRole}','${other}','Other');
insert into organization_members values('${org}','${owner}','owner',null),('${org}','${member}','employee','${role}'),('${other}','${outsider}','owner','${otherRole}');
insert into knowledge_chunks(id,organization_id,content,source_type) values('${k}','${org}','Refunds over $500 require manager approval.','rule'),('${foreignK}','${other}','Private other-company rule','rule');
insert into external_ai_connections(id,organization_id,name) values('${connection}','${org}','Support Agent');
insert into knowledge_test_cases(id,organization_id,connection_id,title,question,consumer,expected_outcome,expected_knowledge_ids) values('${test}','${org}','${connection}','Refund approval','Can I refund $750?','connected_ai','answered',ARRAY['${k}'::uuid]);
select set_config('test.user','${owner}',false),set_config('test.role','authenticated',false);`);
const q = async (sql) => (await db.query(sql)).rows;
async function rejects(sql, code) {
  try {
    await db.exec(sql);
    assert.fail("Expected SQL rejection");
  } catch (e) {
    if (e.code !== code) throw e;
  }
}
await rejects(
  `select assign_role_knowledge('${org}','${role}',ARRAY['${foreignK}'::uuid])`,
  "42501",
);
await db.exec(
  `select assign_role_knowledge('${org}','${role}',ARRAY['${k}'::uuid]);select assign_role_knowledge('${org}','${role}',ARRAY['${k}'::uuid]);`,
);
assert.equal(
  (await q("select * from training_assignments")).length,
  1,
  "idempotent assignment",
);
const assignment = (await q("select id from training_assignments"))[0].id;
await rejects(
  `select publish_training_scenario('${org}','${k}',1,'scenario','Refund $750?','Refunds are always allowed')`,
  "40001",
);
const scenario = (
  await q(
    `select publish_training_scenario('${org}','${k}',1,'scenario','A customer wants a $750 refund. What do you do?','Refunds over $500 require manager approval.') as id`,
  )
)[0].id;
await db.exec(`select set_config('test.user','${member}',false);`);
await rejects(
  `select assign_role_knowledge('${org}','${role}',ARRAY['${k}'::uuid])`,
  "42501",
);
await rejects(
  `select commit_training_attempt('${org}','${member}','${assignment}',1,null,null,'acknowledged',null,null)`,
  "42501",
);
await db.exec(
  `select set_config('test.role','service_role',false);select commit_training_attempt('${org}','${member}','${assignment}',1,null,null,'acknowledged',null,null);select commit_training_attempt('${org}','${member}','${assignment}',1,'${scenario}',1,'supported','Manager approval is required.','Supported by approved guidance');`,
);
let row = (await q("select * from training_assignments"))[0];
assert.equal(row.acknowledged_version, 1);
assert.equal(row.passed_version, 1);
await db.exec(`select set_config('test.user','${owner}',false);`);
assert.equal(
  (await q(`select training_operational_summary('${org}') as summary`))[0]
    .summary.peopleReady,
  1,
  "summary requires all evidence",
);
await db.exec(`select set_config('test.user','${member}',false);`);
for (let n = 1; n <= 11; n++)
  assert.equal(
    (await q(`select consume_training_budget('${org}') as allowed`))[0].allowed,
    n <= 10,
    "atomic budget includes every reservation",
  );
await rejects(
  `select commit_training_attempt('${other}','${member}','${assignment}',1,null,null,'acknowledged',null,null)`,
  "42501",
);
await db.exec(
  `update knowledge_chunks set content='Refunds  over $500 require manager approval.',current_version=2 where id='${k}';`,
);
row = (await q("select * from training_assignments"))[0];
assert.equal(row.update_required, false);
assert.equal(row.passed_version, 2, "whitespace does not force retraining");
await db.exec(
  `update knowledge_chunks set content='Refunds over $750 require manager approval.',current_version=3 where id='${k}';`,
);
row = (await q("select * from training_assignments"))[0];
assert.equal(row.update_required, true);
assert.equal(
  (
    await q(
      "select * from notifications where type='training_update' and not read",
    )
  ).length,
  1,
  "deduplicated update notification",
);
assert.equal(row.previous_version, 2);
assert.equal(row.passed_version, null);
assert.equal(
  (await q("select * from agent_evaluation_runs")).length,
  1,
  "material change queues dependent test",
);
await rejects(
  `select commit_training_attempt('${org}','${member}','${assignment}',2,null,null,'acknowledged',null,null)`,
  "40001",
);
await db.exec(`select set_config('test.user','${owner}',false);`);
const updatedScenario = (
  await q(
    `select publish_training_scenario('${org}','${k}',3,'scenario','A customer asks for a $1000 refund. What do you do?','Refunds over $750 require manager approval.') as id`,
  )
)[0].id;
await db.exec(
  `select commit_training_attempt('${org}','${member}','${assignment}',3,null,null,'acknowledged',null,null);select commit_training_attempt('${org}','${member}','${assignment}',3,'${updatedScenario}',1,'supported','Ask the manager for approval.','Supported');`,
);
row = (await q("select * from training_assignments"))[0];
assert.equal(row.update_required, false);
assert.equal(row.passed_version, 3);
const run = (await q("select * from claim_training_evaluation()"))[0];
assert.equal(run.attempts, 1);
await db.exec(
  `update external_ai_connections set knowledge_policy='{"mode":"items","knowledgeIds":[]}' where id='${connection}';`,
);
const result = JSON.stringify({
  sources: [{ id: k, version: 3 }],
  trainingStatus: "passed",
}).replaceAll("'", "''");
assert.equal(
  (
    await q(
      `select finish_training_evaluation('${run.id}',1,'${result}','passed') as state`,
    )
  )[0].state,
  "superseded",
  "mid-run permission change cannot pass",
);
assert.equal(
  (await q("select * from agent_evaluation_runs where status='queued'")).length,
  1,
  "superseded run is requeued",
);
// External responses require opt-in scope and durable request identity.
const key = id(40),
  submission = id(41);
await db.exec(`update agent_evaluation_runs set status='superseded',locked_at=null where status in('queued','running');
insert into external_ai_api_keys values('${key}','${org}','${connection}',null);
insert into external_ai_scopes values('${connection}','${org}','knowledge:read');`);
await rejects(
  `select submit_agent_training_response('${org}','${connection}','${key}','${test}','${submission}','{"answer":"Manager approval required","sources":[]}')`,
  "42501",
);
await db.exec(
  `insert into external_ai_scopes values('${connection}','${org}','evaluations:create');`,
);
const submitted = (
  await q(
    `select submit_agent_training_response('${org}','${connection}','${key}','${test}','${submission}','{"answer":"Manager approval required","sources":[]}') as id`,
  )
)[0].id;
assert.equal(
  (
    await q(
      `select submit_agent_training_response('${org}','${connection}','${key}','${test}','${submission}','{"answer":"Manager approval required","sources":[]}') as id`,
    )
  )[0].id,
  submitted,
);
await rejects(
  `select submit_agent_training_response('${other}','${connection}','${key}','${test}','${id(42)}','{"answer":"x","sources":[]}')`,
  "42501",
);
const externalRun = (await q("select * from claim_training_evaluation()"))[0];
assert.equal(externalRun.execution_mode, "agent_response");
await db.exec(
  `select finish_training_evaluation('${externalRun.id}',${externalRun.attempts},'{"sources":[],"trainingStatus":"failed","executionMode":"agent_response"}','failed'); select queue_agent_training_test('${org}','${test}');`,
);
const simulation = (await q("select * from claim_training_evaluation()"))[0];
await db.exec(
  `select finish_training_evaluation('${simulation.id}',${simulation.attempts},'{"sources":[],"trainingStatus":"passed","executionMode":"opryn_context"}','passed');`,
);
let evidence = (
  await q(`select * from knowledge_test_cases where id='${test}'`)
)[0];
assert.equal(
  evidence.last_agent_result.trainingStatus,
  "failed",
  "simulation cannot erase external failure",
);
assert.equal(
  (await q(`select training_operational_summary('${org}') as summary`))[0]
    .summary.agentAttention,
  1,
);
await db.exec(`select set_config('test.user','${owner}',false);`);
assert.equal(
  (
    await q(
      `select read_agent_training_run('${org}','${connection}','${key}','${externalRun.id}') as data`,
    )
  )[0].data.status,
  "failed",
);
assert.equal(
  (
    await q(
      `select read_agent_training_run('${other}','${connection}','${key}','${externalRun.id}') as data`,
    ).catch((e) => ({ code: e.code }))
  ).code,
  "42501",
);
// Invalid permission replacement rolls back the entire configuration.
const priorName = (
  await q(`select name from external_ai_connections where id='${connection}'`)
)[0].name;
await rejects(
  `select update_training_agent_connection('${org}','${connection}','{"name":"Should roll back","scopes":["not-a-scope"]}')`,
  "23514",
);
assert.equal(
  (
    await q(`select name from external_ai_connections where id='${connection}'`)
  )[0].name,
  priorName,
);
assert.equal(
  (
    await q(
      `select count(*)::integer as n from external_ai_scopes where connection_id='${connection}'`,
    )
  )[0].n,
  2,
);
await db.exec(
  `select update_training_agent_connection('${org}','${connection}','{"name":"Support Agent renamed"}');`,
);
// A permissions change increments the config; prior result text is then redacted.
await db.exec(
  `update external_ai_connections set knowledge_policy='{"mode":"subjects","subjects":["policy"]}' where id='${connection}';`,
);
const redacted = (
  await q(
    `select read_agent_training_run('${org}','${connection}','${key}','${externalRun.id}') as data`,
  )
)[0].data;
assert.equal(redacted.status, "superseded");
assert.equal(redacted.result, undefined);
await db.exec(`select disconnect_training_agent('${org}','${connection}');`);
assert.equal(
  (
    await q(
      `select status from external_ai_connections where id='${connection}'`,
    )
  )[0].status,
  "paused",
);
assert.ok(
  (await q(`select revoked_at from external_ai_api_keys where id='${key}'`))[0]
    .revoked_at,
);
assert.ok(
  (await q("select * from agent_evaluation_runs")).length > 0,
  "disconnect preserves evaluation history",
);
await rejects(
  `select submit_agent_training_response('${org}','${connection}','${key}','${test}','${id(43)}','{"answer":"x","sources":[]}')`,
  "42501",
);
await db.exec(
  `select set_config('test.role','authenticated',false);select set_config('test.user','${outsider}',false);grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;set role authenticated;`,
);
assert.equal(
  (await q("select * from agent_evaluation_runs")).length,
  0,
  "tenant RLS hides run history",
);
assert.equal(
  (await q("select * from training_attempts")).length,
  0,
  "tenant RLS hides employee responses",
);
await db.exec("reset role");
await rejects(`select queue_agent_training_test('${org}','${test}')`, "42501");
await db.exec(
  `select set_config('test.role','service_role',false);delete from training_assignments where id='${assignment}';`,
);
assert.ok(
  (await q("select * from training_attempts")).every(
    (a) => a.assignment_id === null && a.knowledge_chunk_id === k,
  ),
  "offboarding preserves source-linked evidence without blocking assignment removal",
);
console.log(
  "PASS: assignment isolation/idempotency, role authorization, grounded scenario approval, server-owned evidence, employee learn/practice/update, whitespace impact, threshold propagation, queue leases, stale configuration guard, external scope and request idempotency, actual failure retention, atomic permission rollback, safe disconnect, history tenant RLS.",
);
await db.close();
