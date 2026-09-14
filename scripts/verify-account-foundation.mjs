// Actual migration and database permissions in isolated PostgreSQL, never production.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import vm from "node:vm";
import { z } from "zod";
const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ||
      "/private/tmp/opryn-nango-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
await db.exec(`
create role anon;create role authenticated;create schema auth;create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema auth,storage to authenticated;
create table auth.users(id uuid primary key);
create table profiles(id uuid primary key,full_name text,updated_at timestamptz);
create table organizations(id uuid primary key,name text,industry text,employee_count int);
create table organization_members(id uuid primary key,organization_id uuid,user_id uuid,permission_level text);
create function is_org_admin(target uuid) returns boolean language sql stable security definer as $$select exists(select 1 from public.organization_members where organization_id=target and user_id=auth.uid() and permission_level in ('owner','admin'))$$;
create table organization_settings(organization_id uuid primary key,employees_can_ask boolean default true,allow_escalations boolean default true,confidence_threshold real default .72,estimated_interruption_minutes real default 3,expert_answers_require_admin_approval boolean default true,ai_process_creation text default 'auto_draft',ai_process_approval_prompt text default 'ask_immediately');
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text,name text);alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;
create table employee_questions(organization_id uuid,assigned_expert_id uuid,status text);
create table knowledge_experts(organization_id uuid,user_id uuid);
create table integrations(organization_id uuid,connected_by uuid,status text);
grant select,insert,update,delete on all tables in schema public,storage to authenticated;
`);
await db.exec(
  readFileSync(
    "supabase/migrations/20260912020000_account_foundation.sql",
    "utf8",
  ),
);
const owner = "10000000-0000-4000-8000-000000000001",
  employee = "10000000-0000-4000-8000-000000000002",
  other = "10000000-0000-4000-8000-000000000003",
  a = "20000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000002";
await db.exec(
  `insert into auth.users values('${owner}'),('${employee}'),('${other}');insert into profiles(id,full_name) values('${owner}','Owner'),('${employee}','Employee'),('${other}','Other');insert into organizations values('${a}','Workspace A','Services',5,'','UTC'),('${b}','Workspace B','Services',5,'','UTC');insert into organization_settings(organization_id) values('${a}'),('${b}');insert into organization_members values('${owner}','${a}','${owner}','owner'),('${employee}','${a}','${employee}','employee'),('${other}','${b}','${other}','owner');set role authenticated;set test.actor='${owner}';`,
);
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
const reject = async (sql, params = []) => {
  await assert.rejects(db.query(sql, params));
  assertions++;
};
const save = async (rev, changes) =>
  (await db.query("select * from save_account_settings($1,$2)", [rev, changes]))
    .rows[0];
let saved = await save(1, {
  display_name: "Alex Chen",
  density: "compact",
  timezone: "America/Los_Angeles",
  notify_questions: false,
});
check(saved.revision === 2, "save increments revision");
check(
  saved.timezone_overridden === true,
  "explicit timezone overrides workspace activity default",
);
check(
  (await db.query("select full_name from profiles where id=$1", [owner]))
    .rows[0].full_name === "Alex Chen",
  "profile name synchronized",
);
await db.query("update profiles set full_name=$1 where id=$2", [
  "Old OAuth name",
  owner,
]);
check(
  (await db.query("select full_name from profiles where id=$1", [owner]))
    .rows[0].full_name === "Alex Chen",
  "OAuth provisioning cannot undo saved name",
);
await reject("select save_account_settings($1,$2)", [
  1,
  { display_name: "Stale" },
]);
await reject("select save_account_settings($1,$2)", [2, { user_id: other }]);
await reject("select save_account_settings($1,$2)", [
  2,
  { density: "invisible" },
]);
await reject("select save_account_settings($1,$2)", [
  2,
  { timezone: "MadeUp/Zone" },
]);
await reject("select save_account_settings($1,$2)", [
  2,
  { avatar_path: `${other}/private.webp` },
]);
await reject("update account_settings set revision=0");
await reject("delete from organizations where id=$1", [a]);
await db.query(
  "insert into storage.objects values(gen_random_uuid(),'account-avatars',$1)",
  [`${owner}/private.webp`],
);
await reject(
  "insert into storage.objects values(gen_random_uuid(),'account-avatars',$1)",
  [`${other}/private.webp`],
);
await db.exec(`set test.actor='${employee}';`);
check(
  (await db.query("select * from account_settings")).rows.length === 0,
  "personal preferences never readable by teammate",
);
check(
  (await db.query("select * from storage.objects")).rows.length === 0,
  "avatar originals are not readable by a teammate",
);
saved = await save(1, { notify_reviews: false });
check(saved.user_id === employee, "employee can save own preferences");
await reject("select save_workspace_settings($1,$2,$3)", [
  a,
  1,
  { name: "Forbidden" },
]);
await db.exec(`set test.actor='${owner}';`);
check(
  (await db.query("select density from account_settings")).rows[0].density ===
    "compact",
  "preferences remain personal",
);
await reject("select save_workspace_settings($1,$2,$3)", [
  b,
  1,
  { name: "Other org" },
]);
await reject("select save_workspace_settings($1,$2,$3)", [
  a,
  1,
  { created_by: employee },
]);
const update = await db.query(
  "select save_workspace_settings($1,$2,$3) revision",
  [a, 1, { name: "New workspace name", allow_escalations: false }],
);
check(update.rows[0].revision === 2, "workspace atomic settings revision");
check(
  (await db.query("select * from workspace_settings_events")).rows.length === 1,
  "audits real settings change",
);
await reject("select save_workspace_settings($1,$2,$3)", [
  a,
  1,
  { name: "Stale" },
]);
await db.query(
  "update organization_settings set employees_can_ask=false where organization_id=$1",
  [a],
);
await reject("select save_workspace_settings($1,$2,$3)", [
  a,
  2,
  { name: "Stale after legacy writer" },
]);
await reject("delete from organization_members where id=$1", [employee]);
await reject("select remove_workspace_member($1,$2)", [a, owner]);
await db.exec(
  `reset role;insert into employee_questions values('${a}','${employee}','needs_owner');set role authenticated;`,
);
await reject("select remove_workspace_member($1,$2)", [a, employee]);
check(
  (await db.query("select member_removal_impact($1,$2) impact", [a, employee]))
    .rows[0].impact.questions === 1,
  "removal reports assignments",
);
await db.exec(
  `reset role;delete from employee_questions;insert into integrations values('${a}','${employee}','connected');set role authenticated;`,
);
await reject("select remove_workspace_member($1,$2)", [a, employee]);
await db.exec(`reset role;delete from integrations;set role authenticated;`);
await db.query("select remove_workspace_member($1,$2)", [a, employee]);
check(true, "unassigned member removal succeeds");
await db.exec(`set test.actor='${other}';`);
check(
  (await db.query("select * from workspace_settings_events")).rows.length === 0,
  "activity isolated",
);
await reject("select member_removal_impact($1,$2)", [a, owner]);
await db.exec("set test.actor='';");
await reject("select save_account_settings($1,$2)", [
  1,
  { display_name: "Anonymous" },
]);
await db.exec("set role anon");
await reject("select save_account_settings($1,$2)", [
  1,
  { display_name: "Anonymous" },
]);
await db.close();

function load(path, deps = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule,
    exports: testModule.exports,
    require: (key) => {
      if (key in deps) return deps[key];
      throw new Error(`Missing test dependency: ${key}`);
    },
    Intl,
    URL,
    Headers,
    Response,
    Request,
    console,
  });
  return testModule.exports;
}
const account = load("lib/account-settings.ts", { zod: { z } }),
  nav = load("lib/settings-navigation.ts");
check(
  !account.accountChangesSchema.safeParse({ notify_questions: "false" })
    .success,
  "strict checkbox input",
);
check(
  !account.accountChangesSchema.safeParse({ avatar_path: "secret" }).success,
  "avatar path not editable through profile API",
);
check(
  !account.accountChangesSchema.safeParse({ timezone: "fake" }).success,
  "timezone validated",
);
check(
  !account.shouldShowNotification("owner_question", {
    ...account.DEFAULT_ACCOUNT_SETTINGS,
    notify_questions: false,
  }),
  "questions delivery preference enforced",
);
check(
  account.shouldShowNotification("connection_failed", {
    ...account.DEFAULT_ACCOUNT_SETTINGS,
    notify_questions: false,
    notify_reviews: false,
    notify_answers: false,
  }),
  "connection warnings cannot be muted",
);
for (const type of [
  "employee_question",
  "expert_answer_needed",
  "question_escalated",
  "external_ai_escalation",
])
  check(
    !account.shouldShowNotification(type, {
      ...account.DEFAULT_ACCOUNT_SETTINGS,
      notify_questions: false,
    }),
    `implemented ${type} preference`,
  );
check(
  !account.shouldShowNotification("ai_process_created", {
    ...account.DEFAULT_ACCOUNT_SETTINGS,
    notify_reviews: false,
  }),
  "real process review notification preference",
);
check(
  !account.shouldShowNotification("question_answered", {
    ...account.DEFAULT_ACCOUNT_SETTINGS,
    notify_answers: false,
  }),
  "actual answer notification preference",
);
check(
  nav.searchSettings("invite employee", false).length === 0,
  "search hides unauthorized sections",
);
check(
  nav.searchSettings("cancel subscription", true)[0].id === "billing",
  "natural settings search",
);
check(
  nav.searchSettings("change name", false)[0].id === "profile",
  "personal profile discovery",
);
const json = (data, init) => new Response(JSON.stringify(data), init);
const origin = load("lib/request-origin.ts", {
  "next/server": { NextResponse: { json } },
});
check(
  origin.rejectCrossOrigin(
    new Request("https://opryn.test/api/account", {
      method: "PATCH",
      headers: { origin: "https://evil.test" },
    }),
  ).status === 403,
  "cross-site blocked",
);
let user = null,
  lastRPC = null;
const supabase = {
  auth: { getUser: async () => ({ data: { user } }) },
  rpc: async (name, args) => {
    lastRPC = { name, args };
    return { data: { revision: 2 } };
  },
};
const api = load("app/api/account/route.ts", {
  "next/server": { NextResponse: { json } },
  zod: { z },
  "@/lib/account-settings": account,
  "@/lib/supabase/server": { createClient: async () => supabase },
  "@/lib/request-origin": origin,
});
const request = (body) =>
  new Request("https://opryn.test/api/account", {
    method: "PATCH",
    headers: {
      origin: "https://opryn.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
check(
  (await api.PATCH(request({ revision: 1, changes: { display_name: "Alex" } })))
    .status === 401,
  "signed-out save denied",
);
user = { id: owner };
check(
  (await api.PATCH(request({ revision: 1, changes: { user_id: other } })))
    .status === 400,
  "identity spoof rejected",
);
check(
  (await api.PATCH(request({ revision: 1, changes: { display_name: "Alex" } })))
    .status === 200,
  "authenticated profile saves",
);
check(
  lastRPC.name === "save_account_settings" && !("user_id" in lastRPC.args),
  "server derives personal identity from auth",
);

let activeOrg = a,
  expectedOrg = a,
  memberships = [{ id: owner, organization_id: a, permission_level: "owner" }];
const contextDb = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({ select: () => ({ eq: async () => ({ data: memberships }) }) }),
};
const contextAPI = load("lib/api.ts", {
  "next/server": { NextResponse: { json } },
  "@/lib/supabase/server": { createClient: async () => contextDb },
  "next/headers": {
    cookies: async () => ({ get: () => ({ value: activeOrg }) }),
    headers: async () => new Headers({ "x-opryn-organization": expectedOrg }),
  },
});
check(
  (await contextAPI.getRequestContext({ admin: true })).membership
    .organization_id === a,
  "owner context bound to active organization",
);
expectedOrg = b;
check(
  (await contextAPI.getRequestContext({ admin: true })).error.status === 409,
  "stale workspace request rejected",
);
expectedOrg = a;
memberships = [
  { id: employee, organization_id: a, permission_level: "employee" },
];
check(
  (await contextAPI.getRequestContext({ admin: true })).error.status === 403,
  "member cannot access owner API",
);
user = null;
check(
  (await contextAPI.getRequestContext()).error.status === 401,
  "signed-out request has no workspace",
);
user = { id: owner };
memberships = [{ id: owner, organization_id: a, permission_level: "owner" }];
const workspaceAPI = load("app/api/settings/workspace/route.ts", {
  "next/server": { NextResponse: { json } },
  zod: { z },
  "@/lib/api": {
    getRequestContext: async () => ({
      user,
      supabase,
      membership: memberships[0],
    }),
  },
  "@/lib/request-origin": origin,
});
check(
  (
    await workspaceAPI.PATCH(
      request({ organizationId: b, revision: 1, changes: { name: "Other" } }),
    )
  ).status === 409,
  "workspace body mismatch denied",
);
check(
  (
    await workspaceAPI.PATCH(
      request({ organizationId: a, revision: 1, changes: { name: "Updated" } }),
    )
  ).status === 200,
  "workspace update uses real revision RPC",
);
check(
  lastRPC.name === "save_workspace_settings" && lastRPC.args.workspace_id === a,
  "workspace save organization derived from authorized context",
);
console.log(
  `Account foundation: ${assertions} assertions passed (isolated database + mocked identity/API boundaries).`,
);
