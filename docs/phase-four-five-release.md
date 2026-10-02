# Phase 4/5 production release — 2026-09-16

- Owner explicitly requested “add 4 and 5 and then deploy.” Deployed the current working tree; no new commit/push, pricing changes, icon changes or billing configuration changes.
- **Live:** https://www.opryn.app. **Target:** production. **Framework:** Next.js 16.3.5 App Router / React 19.2.8. **Status:** READY.
- Final deployment **dpl_j37vmx13vLE47QwMFgXS1LbrJECa**, https://handoff-cm8h3qpkw-nikitas-projects-acfaddb7.vercel.app. Remote build completed in 59 seconds, including the dashboard hydration follow-up.
- Initial Phase 4/5 deployment **dpl_D71Tg8AMwqvZukTvDaJtiDK22bnt**, https://handoff-3n726w1gq-nikitas-projects-acfaddb7.vercel.app, was staged without moving www, then promoted only after schema verification. It was superseded by the timestamp fix.
- Phase 3 application rollback target: **dpl_DuVF61gS3Z9jRYRkgRsvQZfHkqB7**, https://handoff-gytk9ekbd-nikitas-projects-acfaddb7.vercel.app. Preserve additive schema/customer records on application rollback; review trigger/function/column-grant compatibility before reverting schema.

## Database rollout

Production Supabase: `wvrqtmtkyxxwtjposwbc`. Applied exactly:

1. `20260916050000_external_ai_policies.sql`
2. `20260916051000_role_learning.sql`
3. `20260916060000_owner_intelligence.sql`

Dry-run listed only those three. Final migration SQL was executed against the actual schema inside BEGIN/ROLLBACK before application; the real owner aggregation was executed read-only inside that transaction. Independently checked afterward that policy column, role requirements and analysis-run tables were absent. Old replaced function definitions are captured in `artifacts/operational-platform/pre-phase-four-five-functions.sql`—a schema recovery aid, not a full database backup.

Applied with linked database push. CLI emitted a Docker warning for local migration-catalog caching **after successful remote application**. Docker was not required; actual remote migration records and grants were independently verified.

Verified: three history records, RLS enabled on both new tables, anonymous analysis SELECT denied, authenticated analysis INSERT denied, direct browser policy/learning-evidence UPDATE denied, service connection UPDATE retained, browser prune execution denied, commit-time external policy trigger present. Existing legacy permitted training/connection columns remain available.

Counts unchanged across migration: knowledge chunks **144**, proposals **5**, employee questions **39**, training assignments **1**. Analysis runs **0**. No production test fixtures or source/model analysis runs were created. Expired lookup retention cleanup is future scheduled behavior; it does not remove company knowledge/history.

## Checks

- Local build/typecheck/lint passed; both remote builds passed.
- New actual SQL/service/UI fixtures passed. UI widths: 1440, 768, 390; reduced motion, stale/error recovery and no fixture page errors/overflow. Actual dashboard SSR/hydration passed with Los Angeles and Tokyo browser time zones.
- Earlier Phase 2/3 SQL/service tests, Phase 3 UI, human/external answer proposal tests, human/external gap rechecks, external gap service, and communication/provider architecture/privacy assertions passed.
- Production HTTP: homepage/login/icons 200; protected Learning/Analysis redirect to login (307); analysis GET and new learning/policy endpoints reject unauthenticated access (401).
- Live favicon.ico / favicon-48x48.png / apple-touch-icon.png have correct MIME types, status 200 and byte-for-byte matches to the existing local icon artwork.
- Signed-in read-only browser checks: Home with actual aggregate metrics; Team Learning with actual roles/processes; Analysis with actual selected Notion/Confluence sources and no run started; policy form for an existing managed AI connection. Checked 1440/390 layout, no horizontal overflow. Final Home scripts identify the final deployment; browser error check after hydration fix is clean. Restored browser viewport and left Home open.
- Error-log scan for final deployment: no server error logs found at release time. This is a limited release-time observation, not long-term monitoring or full tracing. Existing observability setup was not changed.

## Where to find it

- Connections → AI access → managed connection: narrow knowledge, exclusions, unknown behavior, retention, sourced lookup versions, Test connection.
- Team → Learning: assign role guidance; employee My Learning supports current-version acknowledgement and optional sourced practice.
- Home → Opryn Today: real 30-day operational totals, transparent estimates and evidence-led next decision.
- Knowledge Health → Analyze company knowledge: process one or two already-selected supported sources into reviewable findings.

Full implementation/limits: `docs/phase-four-five-delivery.md`. Learning initially targets approved processes, not arbitrary standalone chunks/collections. MCP OAuth retains its separate existing access model. Analysis is explicitly selected-source batching plus real workspace evidence, not an entire-company crawl or a new semantic cross-document conflict engine. Authenticated write/provider/model E2E, real multi-session/pgvector behavior, feedback quality and scheduler timing remain to be validated safely outside production. The guarded production-style external E2E script was not enabled.
