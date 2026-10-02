// Reuse the real Phase 1 intake SQL fixture, then exercise the new signature.
// Only vector distance is deterministic; no production connection.
import { readFileSync } from "node:fs";
let source = readFileSync("scripts/verify-external-gap-intake.mjs", "utf8");
const scope = readFileSync(
  "supabase/migrations/20260916030000_knowledge_scope_and_test_cases.sql",
  "utf8",
).split("alter table public.knowledge_chunks")[0];
source = source.replace(
  "const id = n =>",
  () => `await db.exec(${JSON.stringify(scope)});
await db.exec("alter table external_ai_escalations add column scope_context jsonb not null default '{}'");
await db.exec(readFileSync('supabase/migrations/20260916032000_scoped_gap_intake.sql','utf8').replace(/extensions\\.vector(?:\\(1536\\))?/g,'real[]'));
const id = n =>`,
);
source = source.replace(
  "await db.close();",
  () => `await db.exec("set test.jwt_role='service_role';update external_ai_connections set status='active'; update external_ai_api_keys set revoked_at=null");
await db.query("insert into external_ai_scopes values($1,$2,'escalations:create')",[org,conn]);
const scopedIntake=(context)=>db.query("select record_external_gap($1,$2,$3,'Regional refund policy?','Context',ARRAY[1::real],true,false,$4) result",[org,conn,key,context]);
const us=(await scopedIntake({regions:['US']})).rows[0].result;
const eu=(await scopedIntake({regions:['EU']})).rows[0].result;
assert.notEqual(us.id,eu.id);
assert.equal((await scopedIntake({regions:['US']})).rows[0].result.id,us.id);
assert.deepEqual((await db.query('select scope_context from external_ai_escalations where id=$1',[us.id])).rows[0].scope_context,{regions:['US']});
await assert.rejects(scopedIntake({effectiveFrom:'2026-09-01'}),e=>e.code==='22023');
console.log('PASS: actual new external intake signature preserves and separates applicability context, deduplicates matching context, rejects date override.');
await db.close();`,
);
await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
