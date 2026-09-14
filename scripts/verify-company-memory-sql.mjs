import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Optional isolated PostgreSQL runtime. No credentials or live database needed.
// OPRYN_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/verify-company-memory-sql.mjs
const modulePath = process.env.OPRYN_PGLITE_MODULE;
if (!modulePath)
  throw new Error(
    "Set OPRYN_PGLITE_MODULE to an installed PGlite module for isolated SQL verification.",
  );
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [orgA, orgB, ownerA, employeeA, expertA, ownerB, roleA, restrictedRole] =
  [1, 2, 3, 4, 5, 6, 7, 8].map(id);
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select current_setting('test.role', true) $$;
  create table profiles(id uuid primary key, full_name text);
  create table organization_members(organization_id uuid, user_id uuid, role_id uuid, permission_level text);
  create function public.is_org_member(org uuid) returns boolean language sql stable as $$ select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid()) $$;
  create function public.is_org_admin(org uuid) returns boolean language sql stable as $$ select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in ('owner','admin')) $$;
  create table knowledge_chunks(id uuid primary key, organization_id uuid, role_id uuid, content text, approved boolean, health_status text, criticality text, current_version integer, last_confirmed_at timestamptz, process_id uuid, rule_id uuid);
  create table knowledge_conflicts(id uuid primary key, organization_id uuid, knowledge_chunk_a uuid, knowledge_chunk_b uuid, status text, conflict_type text, resolved_by uuid, resolved_at timestamptz, resolution text);
  create table knowledge_versions(id uuid default gen_random_uuid(), organization_id uuid, knowledge_chunk_id uuid, version_number integer, content text, changed_by uuid, change_reason text, unique(knowledge_chunk_id,version_number));
  create table knowledge_events(id uuid default gen_random_uuid(), organization_id uuid, event_type text, actor_id uuid, knowledge_chunk_id uuid, metadata jsonb, created_at timestamptz default now());
  create table processes(id uuid primary key, organization_id uuid, status text);
  create table process_rules(id uuid primary key, organization_id uuid, status text, approved_by uuid, approved_at timestamptz);
  create table knowledge_experts(id uuid primary key, organization_id uuid, user_id uuid, knowledge_chunk_id uuid, category text, priority integer);
`);
await db.exec(
  readFileSync(
    new URL(
      "../supabase/migrations/20260908001000_company_memory_reviews.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.query(
  "insert into profiles values ($1,'Owner A'),($2,'Sarah'),($3,'Refund expert'),($4,'Owner B')",
  [ownerA, employeeA, expertA, ownerB],
);
await db.query(
  "insert into organization_members values ($1,$3,null,'owner'),($1,$4,$7,'employee'),($1,$5,$7,'employee'),($2,$6,null,'owner')",
  [orgA, orgB, ownerA, employeeA, expertA, ownerB, roleA],
);
async function auth(user, role = "authenticated") {
  await db.query(
    "select set_config('test.user',$1,false), set_config('test.role',$2,false)",
    [user, role],
  );
}
async function scalar(sql, args) {
  return (await db.query(sql, args)).rows[0].value;
}
async function chunk(n, org = orgA, role = null) {
  await db.query(
    "insert into knowledge_chunks(id,organization_id,role_id,content,approved,health_status,criticality,current_version) values($1,$2,$3,'Refund policy',true,'healthy','critical',1)",
    [id(n), org, role],
  );
  return id(n);
}
const first = await chunk(10),
  second = await chunk(11),
  third = await chunk(12),
  privateSource = await chunk(13, orgA, restrictedRole),
  foreign = await chunk(14, orgB);
await auth(employeeA);
assert.equal(
  await scalar("select knowledge_context_requires_review($1,$2) value", [
    orgA,
    [first],
  ]),
  false,
);
assert.equal(
  await scalar("select knowledge_context_requires_review($1,$2) value", [
    orgA,
    [first, privateSource],
  ]),
  true,
);
assert.equal(
  await scalar("select knowledge_context_requires_review($1,$2) value", [
    orgA,
    [first, foreign],
  ]),
  true,
);
await assert.rejects(
  () => db.query("select confirm_company_knowledge($1,$2,1)", [orgA, first]),
  /Owner or admin/,
);
await auth(ownerB);
await assert.rejects(
  () =>
    db.query("select knowledge_context_requires_review($1,$2)", [
      orgA,
      [first],
    ]),
  /Not authorized/,
);
await auth(ownerA);
await db.query("select confirm_company_knowledge($1,$2,1)", [orgA, first]);
assert.equal(
  await scalar(
    "select count(*)::int value from knowledge_events where event_type='knowledge_confirmed'",
    [],
  ),
  1,
);
await assert.rejects(
  () => db.query("select confirm_company_knowledge($1,$2,2)", [orgA, first]),
  /Knowledge changed/,
);
await db.query(
  "insert into knowledge_conflicts(id,organization_id,knowledge_chunk_a,knowledge_chunk_b,status,conflict_type) values($1,$2,$3,$4,'open','conflict'),($5,$2,$3,$6,'open','conflict')",
  [id(20), orgA, first, second, id(21), third],
);
await assert.rejects(
  () => db.query("select confirm_company_knowledge($1,$2,1)", [orgA, first]),
  /Resolve the conflict/,
);
await assert.rejects(
  () =>
    db.query("select resolve_company_knowledge_conflict($1,$2,'keep_both')", [
      orgA,
      id(20),
    ]),
  /Conflicting policies/,
);
await db.query("select resolve_company_knowledge_conflict($1,$2,'use_first')", [
  orgA,
  id(20),
]);
assert.equal(
  await scalar("select approved value from knowledge_chunks where id=$1", [
    second,
  ]),
  false,
);
assert.equal(
  await scalar("select knowledge_context_requires_review($1,$2) value", [
    orgA,
    [first],
  ]),
  true,
  "Another open conflict must still block answers",
);
assert.equal(
  await scalar(
    "select count(*)::int value from knowledge_versions where knowledge_chunk_id=$1",
    [second],
  ),
  1,
);
await assert.rejects(
  () =>
    db.query("select resolve_company_knowledge_conflict($1,$2,'use_first')", [
      orgA,
      id(20),
    ]),
  /already reviewed/,
);
await db.query("select resolve_company_knowledge_conflict($1,$2,'use_first')", [
  orgA,
  id(21),
]);
assert.equal(
  await scalar("select knowledge_context_requires_review($1,$2) value", [
    orgA,
    [first],
  ]),
  false,
);
await db.query(
  "insert into knowledge_experts values($1,$2,$3,null,'Refunds',1)",
  [id(30), orgA, expertA],
);
await auth(employeeA);
const expert = (
  await db.query(
    "select * from find_company_knowledge_expert($1,'Can I refund this customer?',null)",
    [orgA],
  )
).rows[0];
assert.equal(expert.user_id, expertA);
assert.equal(
  (
    await db.query(
      "select * from find_company_knowledge_expert($1,'Where is payroll?',null)",
      [orgA],
    )
  ).rows.length,
  0,
);
await db.query(
  "delete from organization_members where organization_id=$1 and user_id=$2",
  [orgA, expertA],
);
assert.equal(
  (
    await db.query(
      "select * from find_company_knowledge_expert($1,'Refunds?',null)",
      [orgA],
    )
  ).rows.length,
  0,
  "Departed experts are never routed questions",
);
await auth(ownerA);
await assert.rejects(
  () => db.query("select confirm_company_knowledge($1,$2,1)", [orgA, second]),
  /Knowledge changed/,
);
assert.equal(
  await scalar(
    "select has_function_privilege('anon','public.confirm_company_knowledge(uuid,uuid,integer)','EXECUTE') value",
    [],
  ),
  false,
);
assert.equal(
  await scalar(
    "select has_function_privilege('service_role','public.confirm_company_knowledge(uuid,uuid,integer)','EXECUTE') value",
    [],
  ),
  false,
);
// Exhaust the write allowance without editing any policy content.
await db.query(
  "insert into knowledge_events(organization_id,event_type,actor_id) select $1,'knowledge_confirmed',$2 from generate_series(1,60)",
  [orgA, ownerA],
);
await assert.rejects(
  () => db.query("select confirm_company_knowledge($1,$2,1)", [orgA, first]),
  /Please wait/,
);
await db.close();
console.log(
  "Passed isolated PostgreSQL migration, org/role isolation, version checks, conflict resolution, audit preservation, replay rejection, and active-expert routing.",
);
