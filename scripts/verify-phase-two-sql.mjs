// Isolated PostgreSQL: actual migrations, real[] substitution only for vector type.
// No Supabase connection, production fixtures, provider calls or deployment.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.OPRYN_PGLITE_MODULE));
const db = new PGlite();
const base = readFileSync(
  "scripts/verify-proposal-decisions.mjs",
  "utf8",
).match(/await db\.exec\(`([\s\S]*?)`\);/)[1];
await db.exec(base);
await db.exec(`
create table organizations(id uuid primary key);
create table profiles(id uuid primary key);
create table roles(id uuid primary key,organization_id uuid,name text);
create table external_ai_connections(id uuid primary key,organization_id uuid);
create table employee_questions(id uuid primary key,organization_id uuid,asked_by uuid,origin text);
create table external_ai_escalations(id uuid primary key,organization_id uuid);
create table knowledge_gap_rechecks(id uuid primary key,organization_id uuid,question_id uuid,external_escalation_id uuid,status text,cited_knowledge_ids uuid[]);
alter table organization_members add column role_id uuid;
alter table knowledge_chunks add column library_archived_at timestamptz;
alter table knowledge_proposals alter column id set default gen_random_uuid();
alter table knowledge_proposals add column proposal_type text,add column source_label text,add column created_by uuid,add column content_hash text;
create function is_org_admin(org uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.organization_members where organization_id=org and user_id=auth.uid() and permission_level in ('owner','admin'))$$;
grant usage on schema auth to authenticated;
`);
for (const file of [
  "30000_knowledge_scope_and_test_cases",
  "31000_versioned_proposal_scope",
  "33000_scope_recheck_guard",
])
  await db.exec(
    readFileSync(`supabase/migrations/202609160${file}.sql`, "utf8").replace(
      /extensions\.vector(?:\(1536\))?/g,
      "real[]",
    ),
  );
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [org, other, owner, member, chunk, role, question] = [
  1, 2, 3, 4, 5, 6, 7,
].map(id);
await db.query("insert into organizations values($1),($2)", [org, other]);
await db.query("insert into profiles values($1),($2)", [owner, member]);
await db.query(
  "insert into organization_members values($1,$2,'owner',null),($1,$3,'member',$4)",
  [org, owner, member, role],
);
await db.query("insert into roles values($1,$2,'Manager')", [role, org]);
const scalar = async (sql, args = []) =>
  (await db.query(sql, args)).rows[0].value;
assert.equal(
  await scalar("select valid_knowledge_scope($1) value", [
    { regions: ["US"], effectiveFrom: "2026-09-01" },
  ]),
  true,
);
for (const scope of [
  { foo: [] },
  { roles: [""] },
  { effectiveFrom: "2026-02-30" },
  { effectiveFrom: "2026-09-10", effectiveUntil: "2026-09-01" },
])
  assert.equal(
    await scalar("select valid_knowledge_scope($1) value", [scope]),
    false,
  );
for (const [scope, context, result] of [
  [{}, {}, "matches"],
  [{ regions: ["US"] }, {}, "needs_clarification"],
  [{ regions: ["US"] }, { regions: ["EU"] }, "outside_scope"],
  [
    { roles: ["Manager"], regions: ["US"] },
    { roles: ["manager"], regions: ["us"] },
    "matches",
  ],
  [
    { roles: ["Manager"], regions: ["US"] },
    { roles: ["Employee"] },
    "outside_scope",
  ],
])
  assert.equal(
    await scalar("select knowledge_scope_match($1,$2,'2026-09-16') value", [
      scope,
      context,
    ]),
    result,
  );
assert.equal(
  await scalar("select knowledge_scope_match($1,'{}','2026-09-16') value", [
    { effectiveUntil: "2026-09-15" },
  ]),
  "outside_scope",
);
await db.query(
  "insert into knowledge_chunks(id,organization_id,content,approved,current_version,health_status,criticality) values($1,$2,'Refund limits: Managers may refund $500.',true,1,'healthy','normal')",
  [chunk, org],
);
await db.exec(`set "test.user"='${member}';set "test.role"='authenticated';`);
await assert.rejects(
  db.query("select propose_knowledge_scope($1,$2,1,$3)", [
    org,
    chunk,
    { regions: ["US"] },
  ]),
  (e) => e.code === "42501",
);
await db.exec(`set "test.user"='${owner}';`);
await assert.rejects(
  db.query("select propose_knowledge_scope($1,$2,2,$3)", [org, chunk, {}]),
  (e) => e.code === "40001",
);
await assert.rejects(
  db.query("update knowledge_chunks set scope=$1 where id=$2", [
    { regions: ["US"] },
    chunk,
  ]),
  (e) => e.code === "23514",
);
const proposal = await scalar(
  "select propose_knowledge_scope($1,$2,1,$3) value",
  [org, chunk, { regions: ["US"], roles: ["Manager"] }],
);
assert.deepEqual(
  await scalar("select scope value from knowledge_chunks where id=$1", [chunk]),
  {},
);
const p = (
  await db.query(
    "select *,updated_at::text stamp from knowledge_proposals where id=$1",
    [proposal],
  )
).rows[0];
const revised = await scalar(
  "select set_knowledge_proposal_scope($1,$2,$3,$4,$5) value",
  [
    org,
    proposal,
    p.version,
    p.stamp,
    { regions: ["US"], roles: ["Manager"], channels: ["employee"] },
  ],
);
assert.equal(revised.version, p.version + 1);
await assert.rejects(
  db.query("select set_knowledge_proposal_scope($1,$2,$3,$4,$5)", [
    org,
    proposal,
    p.version,
    p.stamp,
    {},
  ]),
  (e) => e.code === "40001",
);
const latest = (
  await db.query(
    "select *,updated_at::text stamp from knowledge_proposals where id=$1",
    [proposal],
  )
).rows[0];
const accepted = await scalar(
  "select decide_knowledge_proposal($1,$2,$3,$4,$5,'approved','web',ARRAY[1::real],null,1) value",
  [org, proposal, owner, latest.version, latest.stamp],
);
assert.equal(accepted.status, "approved");
assert.equal(
  await scalar(
    "select current_version value from knowledge_chunks where id=$1",
    [chunk],
  ),
  2,
);
assert.deepEqual(
  (
    await db.query(
      "select scope from knowledge_versions where knowledge_chunk_id=$1 order by version_number",
      [chunk],
    )
  ).rows.map((v) => v.scope),
  [{}, latest.scope],
);
await db.query(
  "insert into employee_questions(id,organization_id,asked_by,origin,scope_context) values($1,$2,$3,'employee',$4)",
  [question, org, member, { regions: ["EU"] }],
);
await db.query(
  "insert into knowledge_gap_rechecks values($1,$2,$3,null,'pending',$4)",
  [id(8), org, question, [chunk]],
);
await assert.rejects(
  db.exec("update knowledge_gap_rechecks set status='answered'"),
  (e) => e.code === "23514",
);
await db.query("update employee_questions set scope_context=$1", [
  { regions: ["US"] },
]);
await db.exec("update knowledge_gap_rechecks set status='answered'");
await db.exec(`set role authenticated;set "test.user"='${member}';`);
assert.equal(
  await scalar(
    "select has_table_privilege('authenticated','knowledge_test_cases','INSERT') value",
  ),
  false,
);
assert.equal(
  (await db.query("select * from knowledge_test_cases")).rows.length,
  0,
);
await db.exec("reset role;");
await db.query(
  "insert into knowledge_test_cases(organization_id,title,question,consumer,actor_id,expected_outcome,created_by) values($1,'Refund test','Can I refund?','employee',$2,'answered',$3)",
  [org, member, owner],
);
await db.exec(`set role authenticated;set "test.user"='${member}';`);
assert.equal(
  (await db.query("select * from knowledge_test_cases")).rows.length,
  0,
);
await db.exec(`set "test.user"='${owner}';`);
assert.equal(
  (await db.query("select * from knowledge_test_cases")).rows.length,
  1,
);
await db.exec("reset role;");
console.log(
  "PASS: real Phase 2 scope/version/test-case/recheck migrations in isolated PostgreSQL; validation, global/default scope, exact revisions, approval/version history, member/admin permissions, RLS and commit-time scope mismatch. Vector indexing is not simulated.",
);
await db.close();
