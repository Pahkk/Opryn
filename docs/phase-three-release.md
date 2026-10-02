# Phase 3 production release — 2026-09-16

Explicit user request: deploy. Live: https://www.opryn.app.

- Vercel deployment `dpl_DuVF61gS3Z9jRYRkgRsvQZfHkqB7`, https://handoff-gytk9ekbd-nikitas-projects-acfaddb7.vercel.app, confirmed READY and resolved from the production hostname after promotion.
- Built the current working tree with production configuration using `--prod --skip-domain`, verified authentication boundaries, applied the required database migrations, then promoted. No commit or push was made. Existing icons and business configuration were not changed.
- Previous deployment retained: `dpl_5unruHnaWWrdJDQjx4toL8esQfTi`, https://handoff-efpcdv8fe-nikitas-projects-acfaddb7.vercel.app.
- Supabase linked project: `wvrqtmtkyxxwtjposwbc`. Dry run found exactly four pending migrations. All four were tested against the actual schema inside a transaction ending in ROLLBACK before applying. Artifact: `artifacts/operational-platform/phase-three-migration-validation.sql`.
- Applied and independently confirmed migration records: `20260916040000`, `20260916041000`, `20260916042000`, `20260916043000`.
- The existing conflict function definition was captured in `artifacts/operational-platform/phase-three-prior-conflict-function.sql`. This is a function snapshot, not a full database backup. No customer records were exported or test fixtures inserted.
- Verified actual vector column type `vector(1536)`. Publication RPC is available to authenticated callers with its internal owner/admin checks. Authenticated callers cannot execute the private unguarded conflict function or server-only import-lease function.
- Supabase's Docker warning concerned caching its local migration catalog, not remote application. Remote records were separately verified.
- Latest local production build, typecheck, lint, Phase 3 isolated SQL/service/UI checks passed. Remote Vercel build passed. Production HTTP checks: homepage/login/favicon 200, protected Health/Test/Impact redirect unauthenticated visitors to login (307), Test API rejects anonymous access (401).
- Live browser checks at 1440/390: visible primary headline, no horizontal overflow, no browser exceptions during initial rendering. This is not authenticated Phase 3 provider/model E2E. See the implementation report for component fixtures, screenshots and bounded conflict/scoped-import limitations.

Rollback must be coordinated: the previous app expects the old three-argument conflict function, now renamed/private. Do not merely switch deployments and assume approval/conflict functionality is compatible. Restore compatible function names/grants only after reviewing the new source-promotion/conflict triggers. Preserve additive source fields, knowledge, versions, proposals and decision history; do not delete customer data or migration records as rollback.

Phases 4/5 are not implemented by this release. No provider imports, model calls, approval decisions, live charges or source-update cron invocations were performed as production smoke tests.
