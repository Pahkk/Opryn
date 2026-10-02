// Execute actual Phase 4/5 SQL in isolated PostgreSQL. Vector distance is mocked;
// this is not pgvector/auth/provider E2E and never connects to Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
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
for (const f of [
  "20260916050000_external_ai_policies",
  "20260916051000_role_learning",
  "20260916060000_owner_intelligence",
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
  user,
  foreign,
  role,
  role2,
  proc,
  proc2,
  conn,
  k1,
  k2,
  cluster,
  source,
  integration,
] = Array.from({ length: 15 }, (_, n) => id(n + 1));
await db.query("insert into organizations values($1),($2)", [org, other]);
await db.query("insert into profiles values($1),($2),($3)", [
  owner,
  user,
  foreign,
]);
await db.query("insert into roles values($1,$2,'Support'),($3,$2,'Sales')", [
  role,
  org,
  role2,
]);
await db.query(
  "insert into organization_members values($1,$2,'owner',null),($1,$3,'employee',$4),($5,$6,'owner',null)",
  [org, owner, user, role, other, foreign],
);
await db.query(
  "insert into processes(id,organization_id,title) values($1,$2,'Refunds'),($3,$2,'Pricing')",
  [proc, org, proc2],
);
await db.query(
  "insert into knowledge_chunks(id,organization_id,process_id,content,source_type,library_category) values($1,$2,$3,'Refunds: limit $500','rule','policy'),($4,$2,$3,'Pricing: internal','rule','pricing')",
  [k1, org, proc, k2],
);
await db.query(
  "insert into external_ai_connections(id,organization_id,name) values($1,$2,'Support bot')",
  [conn, org],
);
await db.query(
  "insert into external_ai_scopes values($1,$2,'knowledge:read'),($1,$2,'policies:read')",
  [conn, org],
);
await db.query(
  `select set_config('test.user',$1,false),set_config('test.role','authenticated',false)`,
  [owner],
);
const fails = async (fn, code) => {
  try {
    await fn();
    assert.fail("Expected rejection");
  } catch (e) {
    assert.equal(e.code, code, e.message);
  }
};
const match = async () =>
  (
    await db.query(
      "select id from match_external_ai_knowledge($1,$2,'v',array['rule'],0.3,20)",
      [conn, org],
    )
  ).rows.map((r) => r.id);
assert.equal((await match()).length, 2);
let updated = (
  await db.query(
    "select updated_at::text from external_ai_connections where id=$1",
    [conn],
  )
).rows[0].updated_at;
const setPolicy = async (policy, mode = "route_expert") => {
  const r = await db.query(
    "select set_external_ai_policy($1,$2,$3,$4,$5,90)::text updated",
    [org, conn, updated, policy, mode],
  );
  updated = r.rows[0].updated;
};
await setPolicy({
  mode: "subjects",
  subjects: ["policy"],
  excludedSubjects: ["pricing"],
});
assert.deepEqual(await match(), [k1]);
await setPolicy({
  mode: "items",
  knowledgeIds: [k2],
  excludedSubjects: ["pricing"],
});
assert.deepEqual(await match(), []);
await setPolicy({ mode: "items", knowledgeIds: [k2] });
assert.deepEqual(await match(), [k2]);
await fails(
  () =>
    db.query(
      "select set_external_ai_policy($1,$2,now()-interval '1 day',$3,'route_expert',90)",
      [org, conn, { mode: "inherit" }],
    ),
  "40001",
);
await fails(
  () => setPolicy({ mode: "items", knowledgeIds: [id(99)] }),
  "42501",
);
assert.deepEqual(await match(), [k2]);
await fails(() => setPolicy({}), "22023");
await db.query(`select set_config('test.user',$1,false)`, [user]);
await fails(() => setPolicy({ mode: "inherit" }), "42501");
await db.query(`select set_config('test.user',$1,false)`, [foreign]);
await fails(
  () => db.query("select owner_knowledge_intelligence($1)", [org]),
  "42501",
);
await db.query(`select set_config('test.user',$1,false)`, [owner]);
await setPolicy({ mode: "inherit" }, "record_only");
await db.exec(`select set_config('test.role','service_role',false);`);
assert.equal(
  (
    await db.query(
      "select record_external_gap($1,$2,$3,'unknown','','v',true) r",
      [org, conn, id(77)],
    )
  ).rows[0].r.routed,
  false,
);
await db.exec(`select set_config('test.role','authenticated',false);`);
await fails(
  () =>
    db.query("select record_external_gap($1,$2,$3,'unknown','','v',true)", [
      org,
      conn,
      id(77),
    ]),
  "42501",
);
await db.query("select assign_role_learning($1,$2,$3)", [org, role, [proc]]);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from training_assignments where user_id=$1",
      [user],
    )
  ).rows[0].n,
  1,
);
await db.query("insert into profiles values($1)", [id(70)]);
await db.query("insert into organization_members values($1,$2,'employee',$3)", [
  org,
  id(70),
  role,
]);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from training_assignments where user_id=$1",
      [id(70)],
    )
  ).rows[0].n,
  1,
);
const current = (
  await db.query("select updated_at::text from processes where id=$1", [proc])
).rows[0].updated_at;
await db.query(`select set_config('test.user',$1,false)`, [user]);
assert.equal(
  (
    await db.query(
      "select record_learning_activity($1,$2,$3,'acknowledged') r",
      [org, proc, current],
    )
  ).rows[0].r.state,
  "acknowledged",
);
await fails(
  () =>
    db.query("select record_learning_activity($1,$2,$3,'acknowledged')", [
      other,
      proc,
      current,
    ]),
  "42501",
);
await db.query(
  "update processes set updated_at=now()+interval '1 minute' where id=$1",
  [proc],
);
await fails(
  () =>
    db.query("select record_learning_activity($1,$2,$3,'practiced')", [
      org,
      proc,
      current,
    ]),
  "40001",
);
await db.query(
  "update organization_members set role_id=$1 where organization_id=$2 and user_id=$3",
  [role2, org, user],
);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from training_assignments where user_id=$1",
      [user],
    )
  ).rows[0].n,
  0,
);
await db.query(`select set_config('test.user',$1,false)`, [owner]);
await db.query("select remove_role_learning($1,$2,$3)", [org, role, proc]);
assert.equal(
  (await db.query("select count(*)::int n from role_learning_requirements"))
    .rows[0].n,
  0,
);
await db.query("insert into organization_settings values($1,3)", [org]);
await db.query(
  "insert into question_clusters values($1,$2,'Rush fees','What are rush fees?','open',now())",
  [cluster, org],
);
for (let n = 0; n < 4; n++)
  await db.query(
    "insert into employee_questions(id,organization_id,asked_by,question,origin,status,answered_by_opryn,escalated,assigned_expert_id,cluster_id) values($1,$2,$3,$4,'web',$5,$6,$7,$8,$9)",
    [
      id(100 + n),
      org,
      user,
      n < 2 ? "Same answered question" : "Rush fees?",
      n < 2 ? "answered" : "needs_owner",
      n < 2,
      n >= 2,
      n >= 2 ? owner : null,
      n >= 2 ? cluster : null,
    ],
  );
await db.query(
  "insert into external_ai_escalations(id,organization_id,connection_id,cluster_id,status,escalated,assigned_to) values($1,$2,$3,$4,'open',true,$5)",
  [id(120), org, conn, cluster, owner],
);
const metrics = (
  await db.query("select owner_knowledge_intelligence($1) r", [org])
).rows[0].r;
assert.equal(metrics.handledTeam, 2);
assert.equal(metrics.eligibleQuestions, 1);
assert.equal(metrics.estimatedMinutes, 3);
assert.equal(metrics.topGap.questions, 3);
assert.equal(metrics.topGap.channels, 2);
assert.equal(metrics.keyPersonDependencies.length, 1);
await db.query("insert into knowledge_feedback values($1,$2,'not_right')", [
  org,
  id(100),
]);
assert.equal(
  (await db.query("select owner_knowledge_intelligence($1) r", [org])).rows[0].r
    .eligibleQuestions,
  1,
); // same-day duplicate 101 remains eligible
await db.query("insert into integrations values($1,$2,'connected')", [
  integration,
  org,
]);
await db.query(
  "insert into integration_sources(id,organization_id,integration_id,provider,title) values($1,$2,$3,'confluence','Refunds')",
  [source, org, integration],
);
await fails(
  () => db.query("select start_company_analysis($1,$2)", [org, [id(999)]]),
  "42501",
);
const run = (
  await db.query("select start_company_analysis($1,$2) r", [org, [source]])
).rows[0].r;
await fails(
  () => db.query("select start_company_analysis($1,$2)", [org, [source]]),
  "40001",
);
await db.query(
  "update company_analysis_runs set created_at=now()-interval '11 minutes' where id=$1",
  [run],
);
assert.notEqual(
  (await db.query("select start_company_analysis($1,$2) r", [org, [source]]))
    .rows[0].r,
  run,
);
assert.equal(
  (
    await db.query("select status from company_analysis_runs where id=$1", [
      run,
    ])
  ).rows[0].status,
  "failed",
);
await db.exec(`select set_config('test.role','service_role',false);`);
await db.query(
  "insert into external_ai_activity(organization_id,connection_id,endpoint,result_status,created_at) values($1,$2,'answer','answered',now()-interval '91 days'),($1,$2,'answer','answered',now())",
  [org, conn],
);
assert.equal(
  (await db.query("select prune_external_ai_activity() n")).rows[0].n,
  1,
);
assert.equal(
  (
    await db.query(
      "select has_function_privilege('authenticated','match_external_ai_knowledge(uuid,uuid,extensions.vector,text[],real,integer)','EXECUTE') allowed",
    )
  ).rows[0].allowed,
  false,
);
await setPolicy({ mode: "inherit", excludedSubjects: ["pricing"] });
await fails(
  () =>
    db.query("insert into knowledge_gap_rechecks values($1,$2,'answered',$3)", [
      org,
      id(120),
      [k2],
    ]),
  "23514",
);
await db.query(
  "insert into knowledge_gap_rechecks values($1,$2,'answered',$3)",
  [org, id(120), [k1]],
);
await fails(
  () =>
    db.query("insert into knowledge_gap_rechecks values($1,$2,'answered',$3)", [
      other,
      id(120),
      [k1],
    ]),
  "23514",
);
await db.exec(`select set_config('test.premium','false',false);`);
await fails(() => setPolicy({ mode: "inherit" }), "42501");
const privileges = (
  await db.query(`select
 has_column_privilege('authenticated','training_assignments','acknowledged_process_updated_at','UPDATE') learning_evidence,
 has_column_privilege('authenticated','training_assignments','process_id','UPDATE') assignment_ownership,
 has_column_privilege('authenticated','training_assignments','origin_role_id','INSERT') role_origin,
 has_column_privilege('authenticated','training_assignments','status','UPDATE') legacy_status,
 has_column_privilege('authenticated','external_ai_connections','knowledge_policy','UPDATE') policy_direct,
 has_column_privilege('authenticated','external_ai_connections','name','UPDATE') legacy_connection_name`)
).rows[0];
assert.deepEqual(privileges, {
  learning_evidence: false,
  assignment_ownership: false,
  role_origin: false,
  legacy_status: true,
  policy_direct: false,
  legacy_connection_name: true,
});
await db.close();
console.log(
  "PASS: actual Phase 4/5 SQL; restrictive policies/scopes, atomic stale/tenant/admin rejection, record-only routing, role assignment/revocation, current-version learning, real ROI deduplication, analysis leases/isolation and retention. Mock vector distance; no production/model/provider access.",
);
