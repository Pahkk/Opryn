// Isolated PostgreSQL verification: never connects to Opryn or a live provider.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
const { PGlite } = await import(
  pathToFileURL(
    process.env.OPRYN_PGLITE_MODULE ||
      "/private/tmp/opryn-nango-verification/node_modules/@electric-sql/pglite/dist/index.js",
  )
);
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select current_setting('test.actor',true)::uuid$$;
grant usage on schema auth to authenticated;
create table organization_members(organization_id uuid,user_id uuid,permission_level text);
create table processes(id uuid primary key,organization_id uuid,title text,summary text,description text,status text,source_url text,source_provider text,learning_source text,source_title text,approved_at timestamptz,updated_at timestamptz default now());
create table knowledge_chunks(id uuid primary key,organization_id uuid,content text,source_type text,source_id uuid,health_status text default 'healthy',approved boolean,process_id uuid,rule_id uuid,created_at timestamptz default now(),updated_at timestamptz default now(),last_confirmed_at timestamptz,source_modified_at timestamptz,criticality text default 'normal',usage_count integer default 0,current_version integer default 1);
create table knowledge_proposals(id uuid primary key,organization_id uuid,title text,proposed_content text,source_label text,related_process_id uuid,updated_at timestamptz default now(),version integer default 1,status text,existing_knowledge_id uuid,approved_knowledge_id uuid,rejected_by uuid,rejected_at timestamptz,rejection_reason text);
create table process_rules(id uuid primary key,organization_id uuid,process_id uuid,status text);
grant select,update,insert on all tables in schema public to authenticated;
`);
for (const table of [
  "processes",
  "knowledge_chunks",
  "knowledge_proposals",
  "process_rules",
  "organization_members",
]) {
  await db.exec(`alter table ${table} enable row level security;
    create policy org_scope on ${table} to authenticated using (organization_id=current_setting('test.org')::uuid) with check (organization_id=current_setting('test.org')::uuid);`);
}
await db.exec(
  readFileSync(
    "supabase/migrations/20260912010000_knowledge_library.sql",
    "utf8",
  ),
);
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  owner = "20000000-0000-4000-8000-000000000001",
  member = "20000000-0000-4000-8000-000000000002";
const processId = "30000000-0000-4000-8000-000000000001",
  chunk = "40000000-0000-4000-8000-000000000001",
  proposal = "50000000-0000-4000-8000-000000000001";
await db.query(
  "insert into organization_members values($1,$2,'owner'),($1,$3,'member')",
  [a, owner, member],
);
await db.query(
  "insert into processes(id,organization_id,title,summary,status,learning_source) values($1,$2,'Refund Policy','Owners approve larger refunds','approved','text'),($3,$4,'Private policy','Private company','approved','text')",
  [processId, a, b, b],
);
await db.query(
  "insert into knowledge_chunks(id,organization_id,content,source_type,approved,process_id) values($1,$2,'Refunds: Owner approval required','rule',true,$3)",
  [chunk, a, processId],
);
await db.query(
  "insert into knowledge_proposals(id,organization_id,title,proposed_content,status,library_category,library_tags,approved_knowledge_id) values($1,$2,'Pricing update','Updated pricing','pending_approval','pricing',array['Finance'],$3)",
  [proposal, a, chunk],
);
await db.exec(
  `set role authenticated; set test.org='${a}';set test.actor='${owner}';`,
);
assert.equal(
  (await db.query("select count(*)::int n from company_knowledge_library"))
    .rows[0].n,
  3,
);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from company_knowledge_library where organization_id=$1",
      [b],
    )
  ).rows[0].n,
  0,
);
assert.deepEqual(
  (await db.query("select knowledge_library_facets($1) f", [b])).rows[0].f,
  { categories: {}, sources: [] },
);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from searchable_company_knowledge where search_text ilike '%Finance%'",
    )
  ).rows[0].n,
  1,
);
await db.query("update knowledge_proposals set status='approved' where id=$1", [
  proposal,
]);
assert.equal(
  (
    await db.query(
      "select library_category from knowledge_chunks where id=$1",
      [chunk],
    )
  ).rows[0].library_category,
  "pricing",
);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from company_knowledge_library where entity='proposal'",
    )
  ).rows[0].n,
  0,
);
await assert.rejects(
  db.query("update processes set library_category='invented' where id=$1", [
    processId,
  ]),
  /check constraint/,
);
await assert.rejects(
  db.query("select archive_library_item($1,$2,'process')", [b, b]),
  /Forbidden/,
);
await db.exec(`set test.actor='${member}'`);
await assert.rejects(
  db.query("select archive_library_item($1,$2,'process')", [a, processId]),
  /Forbidden/,
);
await db.exec(`set test.actor='${owner}'`);
await db.query("select archive_library_item($1,$2,'process')", [a, processId]);
assert.equal(
  (await db.query("select count(*)::int n from company_knowledge_library"))
    .rows[0].n,
  0,
);
assert.equal(
  (await db.query("select approved from knowledge_chunks where id=$1", [chunk]))
    .rows[0].approved,
  false,
);
assert.equal(
  (await db.query("select count(*)::int n from processes")).rows[0].n,
  1,
  "archive retains original record",
);
await assert.rejects(
  db.query("update knowledge_chunks set approved=true where id=$1", [chunk]),
  /archived|check constraint/,
);
await assert.rejects(
  db.query("update processes set status='approved' where id=$1", [processId]),
  /check constraint/,
);
const testModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync("lib/knowledge-library.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { module: testModule, exports: testModule.exports },
);
const classify = testModule.exports.classifyKnowledge;
assert.equal(classify("Refund policy"), "policy");
assert.equal(classify("Pricing and exceptions"), "uncategorized");
assert.equal(classify("Quarterly notes"), "uncategorized");
assert.equal(classify("Employee onboarding"), "training");
await db.close();
console.log(
  "Passed 20 knowledge library checks: migration, org isolation, facets, search, classification, approval propagation, atomic archive and approval guards.",
);

// Execute the real route handlers with explicit identity/database doubles.
let denial = null,
  row = { id: processId, updated_at: "2026-09-12T12:00:00Z" },
  filters = [],
  rpcArgs;
const context = {
  membership: { organization_id: a },
  supabase: {
    from() {
      filters = [];
      const query = {
        select() {
          return query;
        },
        update() {
          return query;
        },
        eq(key, value) {
          filters.push([key, value]);
          return query;
        },
        async maybeSingle() {
          return { data: row, error: null };
        },
      };
      return query;
    },
    async rpc(_name, args) {
      rpcArgs = args;
      return { data: null, error: null };
    },
  },
};
function route(path) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      URL,
      Request,
      Response,
      console,
      require(name) {
        if (name === "next/server") return { NextResponse: Response };
        if (name === "zod") return { z };
        if (name === "@/lib/api")
          return {
            getRequestContext: async (options) => {
              assert.equal(options.admin, true);
              return denial
                ? { error: Response.json({}, { status: denial }) }
                : context;
            },
          };
        if (name === "@/lib/knowledge-library") return testModule.exports;
        if (name === "@/lib/integrations/nango-providers")
          return { getNangoProvider: () => ({ id: "drive" }) };
        throw new Error(`Unexpected dependency ${name}`);
      },
    },
  );
  return exports;
}
const metadata = route("app/api/knowledge-library/metadata/route.ts");
const capability = route("app/api/integrations/capability/route.ts");
const archive = route("app/api/knowledge-library/archive/route.ts");
const req = (path, body, origin = "https://opryn.test") =>
  new Request(`https://opryn.test${path}`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const payload = {
  id: processId,
  entity: "process",
  revision: 1,
  category: "policy",
  tags: ["Finance"],
};
for (const status of [401, 403]) {
  denial = status;
  assert.equal(
    (await metadata.PATCH(req("/metadata", payload))).status,
    status,
  );
  assert.equal(
    (
      await capability.GET(
        new Request(
          "https://opryn.test/capability?provider=google_drive&capability=knowledge_import",
        ),
      )
    ).status,
    status,
  );
}
denial = null;
assert.equal(
  (await metadata.PATCH(req("/metadata", payload, "https://other.test")))
    .status,
  403,
);
assert.equal(
  (
    await metadata.PATCH(
      req("/metadata", { ...payload, category: "constructor" }),
    )
  ).status,
  400,
);
assert.equal((await metadata.PATCH(req("/metadata", payload))).status, 200);
assert.ok(
  filters.some(([key, value]) => key === "organization_id" && value === a),
);
assert.ok(
  filters.some(([key, value]) => key === "library_revision" && value === 1),
);
row = null;
assert.equal((await metadata.PATCH(req("/metadata", payload))).status, 409);
assert.equal(
  (
    await capability.GET(
      new Request(
        "https://opryn.test/capability?provider=unknown&capability=knowledge_import",
      ),
    )
  ).status,
  400,
);
row = {
  id: processId,
  status: "connected",
  auth_platform: "nango",
  capabilities: ["knowledge_import"],
};
assert.equal(
  (
    await (
      await capability.GET(
        new Request(
          "https://opryn.test/capability?provider=google_drive&capability=knowledge_import",
        ),
      )
    ).json()
  ).connectionId,
  processId,
);
assert.ok(
  filters.some(([key, value]) => key === "organization_id" && value === a),
);
assert.equal(
  (
    await archive.POST(
      req("/archive", { id: processId, entity: "process", organizationId: b }),
    )
  ).status,
  400,
);
assert.equal(
  (await archive.POST(req("/archive", { id: processId, entity: "process" })))
    .status,
  200,
);
assert.equal(rpcArgs.target_organization_id, a);
console.log(
  "Passed library/capability route contracts: auth, admin gating, origin, taxonomy validation, stale revision, server-selected tenant and invalid provider. API identity/database are explicit doubles.",
);
