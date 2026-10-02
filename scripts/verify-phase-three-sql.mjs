// Actual Phase 3 SQL in isolated PostgreSQL. Vector is a text domain here:
// transaction/version/access behavior is exercised, not pgvector indexing.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create schema extensions;create domain extensions.vector as text;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create function is_org_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in('owner','admin'))$$;
create function limit_company_memory_reviews(org uuid) returns void language plpgsql as $$begin return;end$$;
create table processes(id uuid primary key,organization_id uuid,title text,summary text,purpose text,status text default 'needs_review',source_provider text check(source_provider in('notion','confluence')),source_url text,source_title text,supersedes_process_id uuid,library_archived_at timestamptz,approved_by uuid,approved_at timestamptz,criticality text default 'normal',updated_at timestamptz default now());
create table process_role_assignments(organization_id uuid,process_id uuid,role_id uuid);
create table process_rules(id uuid primary key,organization_id uuid,process_id uuid,title text,text text,status text,approved_by uuid,approved_at timestamptz);
create table process_steps(id uuid primary key,organization_id uuid,process_id uuid,step_order integer,title text,description text);
create table process_exceptions(id uuid primary key,organization_id uuid,process_id uuid,text text);
create table knowledge_chunks(id uuid primary key default gen_random_uuid(),organization_id uuid,content text,embedding extensions.vector,source_type text,source_id uuid,process_id uuid,rule_id uuid,role_id uuid,approved boolean,current_version integer default 1,last_confirmed_at timestamptz,health_status text default 'healthy',criticality text,scope jsonb not null default '{}',library_archived_at timestamptz);
create table knowledge_versions(organization_id uuid,knowledge_chunk_id uuid,version_number integer,title text,content text,scope jsonb default '{}',changed_by uuid,change_reason text,unique(knowledge_chunk_id,version_number));
create table knowledge_conflicts(id uuid primary key default gen_random_uuid(),organization_id uuid,knowledge_chunk_a uuid,knowledge_chunk_b uuid,conflict_type text,explanation text,status text default 'open',resolved_by uuid,resolved_at timestamptz,resolution text);
create table knowledge_events(organization_id uuid,event_type text,actor_id uuid,metadata jsonb,knowledge_chunk_id uuid,source_type text,source_id uuid,created_at timestamptz default now());
create table knowledge_proposals(id uuid primary key default gen_random_uuid(),organization_id uuid,related_process_id uuid,process_rule_id uuid,status text,approved_by uuid,approved_at timestamptz,approved_knowledge_id uuid,proposal_type text,title text,proposed_content text,source_type text,source_label text,source_id uuid,risk_level text,content_hash text,created_by uuid,scope jsonb default '{}',existing_knowledge_id uuid,version integer default 1,updated_at timestamptz default now(),review_reason text,rejected_by uuid,rejected_at timestamptz,rejection_reason text);
create table notifications(organization_id uuid,entity_type text,entity_id uuid,read boolean);
create table integrations(id uuid primary key,organization_id uuid,provider text,auth_platform text,capabilities text[] default '{}',configuration jsonb default '{}',status text,last_sync_at timestamptz);
create table integration_sources(id uuid primary key default gen_random_uuid(),organization_id uuid,integration_id uuid,provider text check(provider in('notion','confluence')),source_type text check(source_type in('page','database','space')),title text,external_id text,process_id uuid,sync_status text,content_hash text,unique(integration_id,external_id,source_type));
`);
const scopeSql = readFileSync(
  "supabase/migrations/20260916030000_knowledge_scope_and_test_cases.sql",
  "utf8",
);
await db.exec(
  scopeSql.slice(0, scopeSql.indexOf("alter table public.knowledge_chunks")),
);
const reviewSql = readFileSync(
  "supabase/migrations/20260908001000_company_memory_reviews.sql",
  "utf8",
);
await db.exec(
  reviewSql.slice(
    reviewSql.indexOf(
      "create or replace function public.resolve_company_knowledge_conflict",
    ),
    reviewSql.indexOf(
      "create or replace function public.find_company_knowledge_expert",
    ),
  ),
);
await db.exec(
  readFileSync(
    "supabase/migrations/20260916031000_versioned_proposal_scope.sql",
    "utf8",
  ).replace(/extensions\.vector\(1536\)/g, "extensions.vector"),
);
for (const file of [
  "40000_source_freshness",
  "41000_atomic_process_publication",
  "42000_guarded_conflict_reviews",
  "43000_reviewed_conflict_replacement",
])
  await db.exec(
    readFileSync(`supabase/migrations/202609160${file}.sql`, "utf8").replace(
      /extensions\.vector\(1536\)/g,
      "extensions.vector",
    ),
  );
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [
  org,
  other,
  owner,
  employee,
  connection,
  source,
  p0,
  p1,
  p2,
  rule0,
  rule1,
  rule2,
  c0,
] = Array.from({ length: 13 }, (_, i) => id(i + 1));
await db.query(
  "insert into organization_members values($1,$2,'owner'),($1,$3,'employee')",
  [org, owner, employee],
);
const auth = async (user = owner, role = "authenticated") =>
  db.query(
    "select set_config('test.user',$1,false),set_config('test.role',$2,false)",
    [user, role],
  );
const scalar = async (sql, args = []) =>
  (await db.query(sql, args)).rows[0].value;
await auth();
assert.equal(
  await scalar(
    "select has_function_privilege('authenticated','claim_source_import(uuid,uuid,uuid)','execute') value",
  ),
  false,
);
assert.equal(
  await scalar(
    "select has_function_privilege('authenticated','resolve_company_knowledge_conflict_unchecked(uuid,uuid,text)','execute') value",
  ),
  false,
);
await assert.rejects(
  db.query("select claim_source_import($1,$2,$3)", [org, source, id(50)]),
  (e) => e.code === "42501",
);
await db.query(
  "insert into integrations(id,organization_id,provider,auth_platform,status) values($1,$2,'notion','nango','connected')",
  [connection, org],
);
for (const [p, r, n] of [
  [p0, rule0, 500],
  [p1, rule1, 750],
  [p2, rule2, 900],
]) {
  await db.query(
    "insert into processes(id,organization_id,title,summary,purpose,source_provider,supersedes_process_id,status) values($1,$2,'Refunds','Refund policy','Protect customers','notion',$3,$4)",
    [p, org, p === p0 ? null : p0, p === p0 ? "approved" : "needs_review"],
  );
  await db.query(
    "insert into process_rules values($1,$2,$3,'Refund limits',$4,'draft',null,null)",
    [r, org, p, `Managers may refund $${n}.`],
  );
}
await db.query(
  "insert into knowledge_chunks(id,organization_id,content,source_type,source_id,process_id,rule_id,approved,current_version,criticality) values($1,$2,'Refund limits: Managers may refund $500.','notion',$3,$4,$3,true,1,'normal')",
  [c0, org, rule0, p0],
);
await db.query(
  "insert into integration_sources(id,organization_id,integration_id,provider,source_type,external_id,process_id,approved_process_id,sync_status) values($1,$2,$3,'notion','page','page',$4,$5,'changed')",
  [source, org, connection, p2, p0],
);
await auth(owner, "service_role");
assert.equal(
  await scalar("select claim_source_import($1,$2,$3) value", [
    other,
    source,
    id(50),
  ]),
  false,
);
assert.equal(
  await scalar("select claim_source_import($1,$2,$3) value", [
    org,
    source,
    id(50),
  ]),
  true,
);
assert.equal(
  await scalar("select claim_source_import($1,$2,$3) value", [
    org,
    source,
    id(51),
  ]),
  false,
);
const publish = async (p, r, n, version = {}) => {
  const stamp = await scalar(
    "select updated_at::text value from processes where id=$1",
    [p],
  );
  return db.query("select publish_process_knowledge($1,$2,$3,$4,$5)", [
    org,
    p,
    stamp,
    [
      {
        content: "Refunds. Refund policy\nPurpose: Protect customers",
        source_type: "notion",
        source_id: p,
        rule_id: null,
        embedding: [1, 2],
      },
      {
        content: `Refund limits: Managers may refund $${n}.`,
        source_type: "notion",
        source_id: r,
        rule_id: r,
        embedding: [1, 2],
      },
    ],
    version,
  ]);
};
await auth(employee);
await assert.rejects(publish(p2, rule2, 900), (e) => e.code === "42501");
await auth();
await assert.rejects(publish(p2, rule2, 900), (e) => e.code === "40001");
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where process_id=$1",
    [p2],
  ),
  0,
  "Lease failure rolls back prepared publication",
);
await db.query(
  "update integration_sources set import_lease_token=null,import_lease_until=null where id=$1",
  [source],
);
await assert.rejects(publish(p1, rule1, 750), (e) => e.code === "40001");
assert.equal(
  await scalar("select approved value from knowledge_chunks where id=$1", [c0]),
  true,
  "Stale draft does not retire approved baseline",
);
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where process_id=$1",
    [p1],
  ),
  0,
);
await assert.rejects(publish(p2, rule2, 899), (e) => e.code === "40001");
await publish(p2, rule2, 900);
assert.equal(
  await scalar("select approved value from knowledge_chunks where id=$1", [c0]),
  false,
);
assert.equal(
  await scalar(
    "select approved_process_id::text value from integration_sources where id=$1",
    [source],
  ),
  p2,
);
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where process_id=$1 and approved",
    [p2],
  ),
  2,
);
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_versions where knowledge_chunk_id=$1",
    [c0],
  ),
  1,
);
// Existing process edits preserve per-item scope in both version snapshots.
const c2 = (
  await db.query(
    "select id,source_id,current_version from knowledge_chunks where process_id=$1",
    [p2],
  )
).rows;
await db.query("update knowledge_chunks set scope=$1 where rule_id=$2", [
  { regions: ["US"] },
  rule2,
]);
await db.query(
  "update process_rules set text='Managers may refund $950.' where id=$1",
  [rule2],
);
await publish(
  p2,
  rule2,
  950,
  Object.fromEntries(c2.map((c) => [c.id, c.current_version])),
);
const k2 = await scalar(
  "select id::text value from knowledge_chunks where rule_id=$1",
  [rule2],
);
assert.deepEqual(
  await scalar(
    "select scope value from knowledge_versions where knowledge_chunk_id=$1 and version_number=2",
    [k2],
  ),
  { regions: ["US"] },
);
assert.equal(
  await scalar(
    'select knowledge_scopes_overlap(\'{"regions":["US"]}\',\'{"regions":["EU"]}\') value',
  ),
  false,
);
assert.equal(
  await scalar(
    "select knowledge_scopes_overlap('{}','{\"regions\":[\"EU\"]}') value",
  ),
  true,
);
// Cross-process same-heading monetary disagreement becomes a human conflict.
await db.query(
  "insert into knowledge_chunks(id,organization_id,content,source_type,source_id,process_id,rule_id,approved,current_version,scope) values($1,$2,'Refund limits: Managers may refund $800.','rule',$3,$4,$3,true,1,$5)",
  [id(70), org, id(71), id(72), { regions: ["US"] }],
);
const conflict = (
  await db.query("select * from knowledge_conflicts where status='open'")
).rows[0];
assert.ok(conflict, "Conservative disagreement detection");
const first = await scalar(
  "select current_version value from knowledge_chunks where id=$1",
  [conflict.knowledge_chunk_a],
);
const second = await scalar(
  "select current_version value from knowledge_chunks where id=$1",
  [conflict.knowledge_chunk_b],
);
const resolve = (decision, a = first, b = second) =>
  db.query("select resolve_company_knowledge_conflict($1,$2,$3,$4,$5)", [
    org,
    conflict.id,
    decision,
    a,
    b,
  ]);
await assert.rejects(
  resolve("use_first", first + 1),
  (e) => e.code === "40001",
);
await assert.rejects(resolve("keep_scoped"), (e) => e.code === "23514");
await auth(employee);
await assert.rejects(resolve("use_first"), (e) => e.code === "42501");
await auth();
await db.query(
  "update knowledge_chunks set scope=$1,current_version=current_version+1 where id=$2",
  [{ regions: ["EU"] }, conflict.knowledge_chunk_b],
);
await assert.rejects(resolve("keep_scoped"), (e) => e.code === "40001");
await resolve("keep_scoped", first, second + 1);
assert.equal(
  await scalar("select status value from knowledge_conflicts where id=$1", [
    conflict.id,
  ]),
  "resolved",
);
assert.deepEqual(
  await scalar(
    "select scope value from knowledge_versions where knowledge_chunk_id=$1 and version_number=$2",
    [conflict.knowledge_chunk_b, second + 1],
  ),
  { regions: ["EU"] },
);
// Updated rule uses real canonical proposal approval; failures roll back the
// conflict decision, both withdrawals and the proposal itself.
for (const [chunk, n] of [
  [id(80), 100],
  [id(81), 200],
])
  await db.query(
    "insert into knowledge_chunks(id,organization_id,content,source_type,approved,current_version,scope,role_id) values($1,$2,$3,'owner_answer',true,1,$4,$5)",
    [
      chunk,
      org,
      `Discount limits: Managers may approve $${n}.`,
      { regions: ["US"] },
      id(82),
    ],
  );
const c = (
  await db.query(
    "select * from knowledge_conflicts where status='open' and knowledge_chunk_a=$1",
    [id(80)],
  )
).rows[0];
assert.ok(c);
await db.exec(
  `create function fixture_fail_publish() returns trigger language plpgsql as $$begin if new.content like '%FAIL%' then raise exception 'Fixture publication failure' using errcode='22023';end if;return new;end$$;create trigger fixture_fail before insert on knowledge_chunks for each row execute function fixture_fail_publish();`,
);
const replace = (content) =>
  db.query(
    "select replace_company_knowledge_conflict($1,$2,1,1,$3,$4,$5) value",
    [org, c.id, "Discount limits", content, "[1,2]"],
  );
await assert.rejects(
  replace("FAIL: Managers may approve up to $150."),
  (e) => e.code === "22023",
);
assert.equal(
  await scalar("select status value from knowledge_conflicts where id=$1", [
    c.id,
  ]),
  "open",
);
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where id in($1,$2) and approved",
    [id(80), id(81)],
  ),
  2,
);
assert.equal(
  await scalar("select count(*)::integer value from knowledge_proposals"),
  0,
);
const replacement = (await replace("Managers may approve up to $150.")).rows[0]
  .value;
assert.equal(replacement.status, "approved");
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where id in($1,$2) and approved",
    [id(80), id(81)],
  ),
  0,
);
assert.equal(
  await scalar("select role_id::text value from knowledge_chunks where id=$1", [
    replacement.knowledgeId,
  ]),
  id(82),
);
assert.equal(
  await scalar("select source_type value from knowledge_chunks where id=$1", [
    replacement.knowledgeId,
  ]),
  "owner_answer",
);
assert.deepEqual(
  await scalar(
    "select scope value from knowledge_versions where knowledge_chunk_id=$1 and version_number=1",
    [replacement.knowledgeId],
  ),
  { regions: ["US"] },
);
// A scoped source cannot become global through automatic regeneration.
await db.query(
  "insert into processes(id,organization_id,title,summary,purpose,source_provider,supersedes_process_id) values($1,$2,'Refunds','Refund policy','Protect customers','notion',$3)",
  [id(90), org, p2],
);
await db.query(
  "insert into process_rules values($1,$2,$3,'Refund limits','Managers may refund $975.','draft',null,null)",
  [id(91), org, id(90)],
);
await db.query(
  "update integration_sources set process_id=$1,review_status='pending',sync_status='changed' where id=$2",
  [id(90), source],
);
await assert.rejects(publish(id(90), id(91), 975), (e) => e.code === "23514");
assert.equal(
  await scalar(
    "select count(*)::integer value from knowledge_chunks where process_id=$1",
    [id(90)],
  ),
  0,
);
await db.query("update processes set status='rejected' where id=$1", [id(90)]);
assert.equal(
  await scalar(
    "select review_status value from integration_sources where id=$1",
    [source],
  ),
  "declined",
);
assert.equal(
  await scalar(
    "select approved_process_id::text value from integration_sources where id=$1",
    [source],
  ),
  p2,
);
console.log(
  "PASS: actual Phase 3 migrations; source leases/isolation, stale draft rollback, atomic replacement, scope-preserving versions, conservative conflict detection, exact-version/admin guards, disjoint-scoped resolution. No production connection.",
);
await db.close();
