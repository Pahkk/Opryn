import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { PGlite } = await import(process.env.OPRYN_PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql as $$ select current_setting('fixture.role', true) $$;
    create table public.organizations(id uuid primary key);
    insert into public.organizations values ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002');`);
  const sql = readFileSync("supabase/migrations/20260916071000_ai_learning_workspace_limits.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql);
  const call = (id) => db.query("select public.consume_ai_learning_rate_limit($1) as allowed", [id]);
  const a = "10000000-0000-4000-8000-000000000001";
  const b = "10000000-0000-4000-8000-000000000002";
  await assert.rejects(call(a), /Not authorized/);
  await db.exec("set fixture.role = 'authenticated'");
  await assert.rejects(call(a), /Not authorized/);
  await db.exec("set fixture.role = 'service_role'");
  for (let i = 0; i < 5; i++) assert.equal((await call(a)).rows[0].allowed, true);
  assert.equal((await call(a)).rows[0].allowed, false);
  assert.equal((await call(b)).rows[0].allowed, true);
  await db.exec("update public.ai_learning_rate_limits set minute_window = now() - interval '2 minutes', hour_count = 25 where organization_id = '10000000-0000-4000-8000-000000000001'");
  assert.equal((await call(a)).rows[0].allowed, false);
  console.log("PASS isolated PostgreSQL: repeatable migration, anonymous/authenticated denial, workspace isolation, minute/hour limits");
} finally { await db.close(); }
