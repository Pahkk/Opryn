# Phase 3 — implementation report

Release update: deployed with explicit user approval on 2026-09-16. The report below records pre-release implementation/testing; its statements about unapplied migrations describe that earlier state. See `docs/phase-three-release.md` for the actual production deployment, migration verification and remaining E2E limitations.

## Product capability delivered

Source Freshness, guarded conflict decisions, source/import comparisons, version comparisons, and Change Impact are implemented on the existing knowledge lifecycle. Phases 1/2 remain the underlying gap/review/test/scope systems. Phases 4/5 were not started. No homepage redesign, icon replacements, pricing changes, billing changes, production migrations, production fixtures, provider calls or charges were performed for this phase.

### Source freshness and replacement

- Google Workspace selected Docs/Sheets/Slides now use the same tracked source-import pipeline as Notion/Confluence, through the existing Nango proxy and capability boundary.
- Additive source fields retain the approved process baseline, previous/latest normalized content, successful check date, review disposition, and bounded import lease. Database privileges remain server-only for source records and lease functions.
- Multiple source edits before approval supersede the approved baseline, not another draft. Obsolete pending drafts are archived, not deleted. Rejected imports retain the approved baseline; scheduled unchanged checks do not recreate denied findings, while explicit reimport can prepare them again.
- Import leases prevent simultaneous extraction of one source. Workers reread after claiming the lease, verify connection access again after extraction, and preserve pending state on unchanged content. A failed source save removes only the uncommitted draft.
- Process knowledge publication is a single authenticated owner/admin database transaction: child content, process timestamp and existing versions are checked; chunk versions/scope are retained; source promotion and predecessor withdrawal occur together. Failure rolls back all publication writes.
- Scoped/restricted source regeneration is intentionally blocked. Use existing per-item versioned review rather than automatically broadening applicability or access. This is a known bulk-source limitation, not a claim that scope is automatically remapped.
- Existing selected Google imports are adopted by the migration using actual organization/process/file provenance. Historical normalized snapshots were not recorded by the old importer, so their first check prepares reviewable content without claiming a proven change.
- Existing daily/bounded source worker remains with a six-hour eligibility cooldown; transient failures retry, while permission/unavailable states require attention/manual check. The manual action checks at most 20 selected records, oldest attempted checks first. Cron checks at most 12 per run. This does not introduce provider webhooks or whole-workspace crawling.

### Conflict handling

- Conservative automatic detection flags exact rule headings with different monetary/percentage limits across overlapping scopes/separate processes. Source successor/predecessor pairs are excluded. It is potential-conflict detection, not exhaustive semantic contradiction detection.
- Needs You shows both actual answer versions. Use First/Second requires the exact current versions; stale or unauthorized decisions fail. Scope is retained in version snapshots. Unresolved conflicts continue to block canonical retrieval.
- Already-disjoint scopes may be retained together. An overlapping pair cannot be kept as two official rules by this action.
- Create an updated rule requires explicit human review/authorization. A server-prepared embedding feeds the existing canonical proposal decision RPC in one transaction with conflict resolution and old-answer withdrawal. New guidance is attributed to a human-reviewed decision, not falsely to the old document. The first answer's applicability/access boundary is explicitly disclosed and retained. Related old processes need review. Replacement is a new approved record/version 1; old versions and decision relationships remain traceable.
- The old unversioned conflict RPC is renamed/private; direct authenticated execution is revoked. This release must be coordinated with its migration.

### Change Impact / versions

- Individual Knowledge detail → View impact at `/app/knowledge/[id]/impact`.
- Shows actual shared-process/replacement relationships, saved tests referencing current/replaced knowledge, and last-30-day recorded question citations.
- Connection eligibility uses current entitlement, active connection, configured API scopes and source-access policy. Actual lookups still require applicable context/trust/key checks. This is **policy permission**, not proof of external refresh/recent retrieval.
- Existing citation rows do not identify historical versions. External logs do not identify every retrieved item. No historical-version-use counts or fabricated downstream impact are presented.
- Large datasets are bounded below default API row limits; partial views are explicitly labeled. Test links open the exact tenant-scoped saved test rather than only the newest 50.
- Version history compares a recorded version with current content/applicability. Source history at `/app/knowledge/sources/[id]` compares immediate previous/latest imports; those imports may not have been approved.
- Knowledge Health and Test Opryn are now visible in Knowledge's header. Health includes selected Source Updates, availability, check dates, provider version, check/retry and review/history actions. Company Guide documentation/targets include these real capabilities.

## Main changed files/routes

- `lib/integrations/source-import.ts`, `google-source.ts`, `content-providers.ts`, `catalog.ts`
- Existing Nango import/check and source-update cron routes; Teach/connection busy handling
- `lib/opryn/processes/approval.ts`, `lib/opryn/needs-you.ts`, `lib/opryn/knowledge/{scope,proposals,impact,source-freshness}.ts`
- `components/app/{knowledge-impact,source-freshness,conflict-replacement,knowledge-library,needs-you-center,knowledge-testbench}.tsx`
- `/app/knowledge/[id]/impact`, `/app/knowledge/sources/[id]`, existing Health/history/Test pages and Teach source summary
- `/api/knowledge-conflicts/[id]/replace`, existing Learning Inbox/Test/process approval routes
- Guide registry and operational product-help documentation

## Schema and rollout gate

Four local additive migrations, **not applied to production**:

1. `20260916040000_source_freshness.sql`
2. `20260916041000_atomic_process_publication.sql`
3. `20260916042000_guarded_conflict_reviews.sql`
4. `20260916043000_reviewed_conflict_replacement.sql`

Before release, validate against a representative nonproduction database with real pgvector/auth and provider adapters. Capture replaced function definitions, verify migration history/privileges and approve a coordinated database+application rollout. Do not deploy the new app against the old schema: imports and approval now depend on the new functions/columns.

Rollback should preserve customer source content, histories, decisions and additive columns. Restore compatible prior conflict function names/grants and review source-promotion/conflict triggers before rolling back the app; simply deleting migrations is not rollback. Do not delete customer knowledge. No new environment variables/dependencies/products are required; existing Nango provider IDs/secrets and CRON_SECRET remain required. Existing Vercel cron configuration is retained.

## Verification / visual evidence

- Actual four Phase 3 SQL migrations plus canonical proposal decision SQL executed in isolated PGlite PostgreSQL: leases/tenant/admin guards, stale draft rejection, full publication rollback, baseline promotion, scope-preserving versions, conflict detection/guarded resolution, canonical replacement rollback/publication, and denied/scoped source safety.
- PGlite uses a text domain for vector values; this **does not verify pgvector dimensions/indexes or real Supabase auth**. Notification/rate-limit boundaries have isolated fixtures, not a complete production schema.
- Actual importer/Google normalizer/freshness/access helpers bundled with fake provider/model/database boundaries: explicit selection, lineage, unchanged/declined state, concurrent lease, disconnect/save recovery, availability vs transient failure, and policy filtering. No real Google/Notion/Confluence credentials or AI calls.
- Actual React components rendered with isolated HTTP/router fixtures at 1440 and 390: import comparisons, check/retry status, explicit replacement/revision payload, error/success handling, reduced motion, no horizontal overflow or browser exceptions. This is **not authenticated application E2E**. Desktop/mobile screenshots were visually reviewed.
- Screenshots: `artifacts/operational-platform/phase-three-{impact,freshness,conflict}-{1440,390}.png`.
- Fixture recording: `artifacts/operational-platform/phase-three-fixture.webm` (not a real customer/provider flow).
- New SQL/service/UI scripts: `scripts/verify-phase-three-{sql,service,ui}.mjs`.
- Phase 1 recheck/external service and Phase 2 SQL/testbench service regressions passed; provider integration/privacy checks passed.
- Production build, TypeScript and whole-repo ESLint checks passed. No extra animation/dependency stack; server-side impact queries run independent datasets in parallel, source reads are bounded, and Motion uses existing reduced-motion-aware wrappers. No Core Web Vitals benchmark or real-provider performance measurement is claimed.

## Remaining limitations / unfinished broader project

Real authenticated provider/model-backed E2E on a nonproduction Supabase environment remains required before certifying release. Scoped source regeneration needs per-item review, automated conflict detection is intentionally conservative/not exhaustive, import comparisons retain only the latest two normalized snapshots (older approved process/knowledge history remains), impact relations are recorded rather than inferred, and external per-item/version lookup attribution is not yet implemented. Scheduled checking relies on the existing cron actually being configured/executed in the deployment environment. Phases 4/5 (expanded AI controls/role learning/ROI/company analysis) remain unfinished and are not advertised as completed.
