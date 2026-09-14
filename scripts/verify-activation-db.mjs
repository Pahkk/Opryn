// Isolated PostgreSQL fixtures; no production connection or customer records.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ||
      "/private/tmp/opryn-nango-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
const foundation = readFileSync(
  "scripts/verify-account-foundation.mjs",
  "utf8",
).match(/await db.exec\(`([\s\S]*?)`\);/)[1];
await db.exec(foundation);
await db.exec(
  readFileSync(
    "supabase/migrations/20260912020000_account_foundation.sql",
    "utf8",
  ),
);
await db.exec(
  `create table organization_discovery(organization_id uuid,business_description text);create table processes(id uuid primary key);create table organization_onboarding(organization_id uuid primary key);`,
);
const org = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002";
await db.exec(
  `insert into auth.users values('${owner}'),('${member}');insert into organizations(id,name,industry,employee_count) values('${org}','Example','Services',3),('${other}','Other','Services',2);insert into organization_settings(organization_id) values('${org}'),('${other}');insert into organization_members values(gen_random_uuid(),'${org}','${owner}','owner'),(gen_random_uuid(),'${org}','${member}','employee');insert into organization_discovery values('${org}','Existing business description');`,
);
await db.exec(
  readFileSync(
    "supabase/migrations/20260914020000_activation_company.sql",
    "utf8",
  ),
);
await db.exec(
  `create role service_role;alter table employee_questions add column id uuid primary key,add column answered_by_opryn boolean;create table organization_subscriptions(organization_id uuid primary key,stripe_subscription_id text,status text);alter table processes add column organization_id uuid,add column status text,add column library_archived_at timestamptz;alter table organization_onboarding add column first_test_answered boolean not null default false,add column onboarding_complete boolean not null default false;`,
);
await db.exec(
  "alter table organization_subscriptions add column trial_used boolean not null default false",
);
await db.exec(
  readFileSync(
    "supabase/migrations/20260915010000_assisted_activation.sql",
    "utf8",
  ),
);
assert.equal(
  (await db.query("select description from organizations where id=$1", [org]))
    .rows[0].description,
  "Existing business description",
);
const profile = {
  name: "Example Studio",
  description: "Design and support",
  industry: "Services",
  employee_count: 4,
  website: "https://example.test",
  departments: "Support",
  knowledge_areas: ["Policies"],
  notes: "",
  normalizedIndustryId: "professional_services",
  firstTeachQuestion: "Who approves refunds?",
};
await db.exec(
  `set role authenticated;select set_config('test.actor','${owner}',false);`,
);
const save = (workspace, revision, p = profile) =>
  db.query("select save_company_profile($1,$2,$3::jsonb) as revision", [
    workspace,
    revision,
    JSON.stringify(p),
  ]);
assert.equal((await save(org, 1)).rows[0].revision, 2);
await assert.rejects(save(org, 1));
await assert.rejects(save(other, 1));
await assert.rejects(save(org, 2, { ...profile, api_key: "not allowed" }));
await assert.rejects(
  save(org, 2, { ...profile, normalizedIndustryId: "invented" }),
);
for (let i = 0; i < 20; i++)
  assert.equal(
    (await db.query("select consume_setup_suggestion_limit() as ok")).rows[0]
      .ok,
    true,
  );
assert.equal(
  (await db.query("select consume_setup_suggestion_limit() as ok")).rows[0].ok,
  false,
);
await db.exec(`select set_config('test.actor','${member}',false);`);
await assert.rejects(save(org, 2));
await db.exec("reset role;set role anon;");
await assert.rejects(save(org, 2));
await db.exec("reset role;");
const stored = (
  await db.query(
    "select name,description,company_profile from organizations where id=$1",
    [org],
  )
).rows[0];
assert.equal(
  stored.company_profile.normalizedIndustryId,
  "professional_services",
);
await db.exec(
  `insert into organization_onboarding(organization_id) values('${org}');`,
);
await assert.rejects(
  db.exec(
    `update organization_onboarding set first_test_answered=true where organization_id='${org}'`,
  ),
);
await assert.rejects(
  db.exec(
    `update organization_onboarding set billing_required=false where organization_id='${org}'`,
  ),
);
await db.exec(
  `insert into processes values('${owner}','${org}','approved',null);insert into employee_questions(id,organization_id,answered_by_opryn,status) values('${owner}','${org}',true,'answered');update organization_onboarding set activation_process_id='${owner}',activation_answer_id='${owner}',first_test_answered=true where organization_id='${org}';`,
);
await assert.rejects(
  db.exec(
    `update organization_onboarding set onboarding_complete=true where organization_id='${org}'`,
  ),
);
await db.exec(
  `insert into organization_subscriptions(organization_id,stripe_subscription_id,status) values('${org}','sub_test','trialing');update organization_onboarding set onboarding_complete=true where organization_id='${org}';`,
);
await db.exec("set role authenticated");
await assert.rejects(
  db.query("select claim_organization_checkout($1,'test',$2)", [org, owner]),
);
await db.exec("reset role;set role service_role");
assert.ok(
  (
    await db.query(
      "select claim_organization_checkout($1,'test',$2) as lease",
      [org, owner],
    )
  ).rows[0].lease,
);
assert.equal(
  (
    await db.query(
      "select claim_organization_checkout($1,'test',$2) as lease",
      [org, owner],
    )
  ).rows[0].lease,
  null,
);
await db.exec("reset role");
assert.equal(stored.name, profile.name);
assert.equal(stored.company_profile.website, profile.website);
assert.equal(stored.company_profile.name, undefined);
assert.equal(
  (
    await db.query(
      "select business_description from organization_discovery where organization_id=$1",
      [org],
    )
  ).rows[0].business_description,
  profile.description,
);
await db.exec(
  `alter table employee_questions add column asked_by uuid;create table question_sources(organization_id uuid,question_id uuid);create table question_answers(organization_id uuid,question_id uuid,answer_type text);update employee_questions set asked_by='${owner}';set role authenticated;select set_config('test.actor','${owner}',false);`,
);
assert.equal(
  (await db.query("select record_activation_answer($1,$2) as ok", [org, owner]))
    .rows[0].ok,
  false,
);
await db.exec(
  `reset role;insert into question_sources values('${org}','${owner}');insert into question_answers values('${org}','${owner}','opryn');set role authenticated;`,
);
assert.equal(
  (await db.query("select record_activation_answer($1,$2) as ok", [org, owner]))
    .rows[0].ok,
  true,
);
assert.equal(
  (
    await db.query("select record_activation_answer($1,$2) as ok", [
      other,
      owner,
    ])
  ).rows[0].ok,
  false,
);
await db.exec(`select set_config('test.actor','${member}',false);`);
assert.equal(
  (await db.query("select record_activation_answer($1,$2) as ok", [org, owner]))
    .rows[0].ok,
  false,
);
await db.exec("reset role");
assert.ok(
  (
    await db.query(
      "select activation_completed_at from organization_subscriptions where organization_id=$1",
      [org],
    )
  ).rows[0].activation_completed_at,
);
await db.exec(
  `update organization_subscriptions set trial_used=true where organization_id='${org}';update organization_subscriptions set trial_used=false where organization_id='${org}';`,
);
assert.equal(
  (
    await db.query(
      "select trial_used from organization_subscriptions where organization_id=$1",
      [org],
    )
  ).rows[0].trial_used,
  true,
);
await db.close();
console.log(
  "PASS activation migration: legacy description preserved, canonical profile, revision conflict, tenant isolation, member/anonymous denial, unknown field rejection, legacy reader mirror",
);
