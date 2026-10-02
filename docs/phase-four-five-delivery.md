# Phase 4 and 5: operational-knowledge capability release

## Scope

Phase 4 extends the existing external AI connections, Test Opryn, process assignments and roles. Phase 5 extends existing recorded activity, Knowledge Health, Teach Next and the selected-source importer. No second knowledge engine, billing system, provider framework or top-level dashboard was created. Prices, trial rules, approval authority, current icons and public-site design are unchanged.

## Phase 4: external AI controls

- Connections → AI access → managed connection: **What this AI can know**. Keep existing access, narrow to selected knowledge areas (the canonical library categories), or select individual approved items. Exclusions always win; an empty restricted selection allows nothing. Existing source-type scopes, legacy source access, active connection/key, Premium entitlement, organization isolation and business scope still apply.
- Updates are admin/Premium-checked, revision-checked transactions with the existing audit events. New policy fields cannot be directly updated through browser table grants. The approved item selector displays at most 500 candidates and clearly discloses that limit; policies accept at most 200 selections.
- Unknown behavior: existing expert routing with owner fallback, or record the gap without notifying a human. Routing still requires escalation permission and the workspace's existing routing setting. This does not add a new per-connection custom expert override.
- Existing Test Opryn simulates the selected managed connection's actual access; it does not send external messages. Retrieval is server-filtered. Answer delivery rechecks cited content/version, key, plan and policy after model work. The canonical gap-recheck queue has an additional commit-time policy guard.
- Minimal lookup records now include actual knowledge IDs/versions; connection detail shows recent sourced lookups and existing request/failure status. Legacy logs have no invented version. Retention is configurable 7–365 days, default 90; existing daily source-update cron removes up to 5,000 expired lookup logs per run. This never deletes company knowledge, gaps or approval history. Expired logs cannot be restored by application rollback.
- These policies govern API-key-backed managed external AI connections. OAuth MCP grants keep their existing separate role/scoped permission model; there is no claim that this editor controls every MCP grant.

## Phase 4: role-based learning

- Team → Learning: admins assign existing approved processes to a role, optionally filter by business area, and remove requirements. Requirements apply to current and future role members. Role-origin assignments are withdrawn when membership changes; independent assignments are retained. The existing individual assignment editor cannot remove a role requirement.
- My Learning uses honest **Not started / Viewed / Acknowledged / Practiced** evidence. Acknowledgment and practice reference the process revision; updated guidance requires reading again. Historical completed records remain legacy self-reports, not current-version certification.
- Optional practice asks the learner to explain how they would apply the actual guidance. Feedback uses only approved, accessible, scope-matching guidance and requires an exact supporting quote. Changed guidance/access fails closed. The learner response is not persisted; the OpenAI request uses `store:false`. It is still sent to the configured AI provider for this requested operation.
- Existing thinking-orb wrapper appears only during actual practice feedback. No scoring, employee ranking, surveillance or mastery claim.
- Initial role learning uses the canonical **process** assignment model. Standalone FAQ/chunk assignments, team/collection-wide assignment, generated scenario libraries and an LMS are not added.

## Phase 5: owner intelligence

- Home: Opryn Today shows actual 30-day answered/routed activity, current open gaps, recently resolved clusters, human-answer proposals approved in the period, and transparently estimated time returned. Aggregation is server-side across the organization, not a silently truncated browser list.
- Savings estimate = eligible employee questions × the existing workspace interruption-minutes setting (bounded 0.1–30). Same actor/normalized question/UTC day is deduplicated. Negative feedback, human-routed questions and external AI are excluded from savings. It is not measured hours or money saved.
- External answered totals are retained lookup logs, so short retention may limit the 30-day total. Resolved gaps are currently resolved clusters updated during this period, not a lifetime resolution-event counter. No unsupported “every repeat eliminated” claim.
- One evidence-led recommendation prioritizes critical conflicts, recurring unresolved gaps, pending source findings, then used guidance overdue for confirmation. Routing dependency is based on recent unresolved questions assigned to one person, not an employee performance measure or proof nobody else knows the answer.
- Reuses existing events/questions/proposals/lookups rather than introducing parallel analytics records.

## Phase 5: company knowledge analysis

- Knowledge Health → **Analyze company knowledge**, `/app/knowledge/analysis`. Admin chooses 1–2 sources already selected in Teach, from connected Google Workspace/Notion/Confluence.
- Runs the existing normalizer/importer/extractor only for new or changed content. Creates draft findings for review; never silently replaces approved guidance. Unchanged sources are not extracted again. One active analysis per organization; stale runs can be retried without deleting prepared findings.
- Reports real workspace counts and prepared findings, plus existing gaps/conflicts/source issues/routing dependencies. Policy count uses the actual policy category; FAQ count uses actual FAQ source type. Bounded health/source summaries disclose their limits.
- Every issue links to its canonical destination: source findings → Review; gaps/conflicts → Needs You; source issues → Health; missing guidance → Teach. Partial failures preserve successful findings. Orb state is driven by the actual AI extraction hook, not ordinary source checks/database loading.
- This is a selected-source batch analysis plus workspace evidence, **not** an entire-company crawl, new cross-document semantic conflict engine or automatic company-profile factual rewrite. Existing conservative conflict detection is retained.

## Files and schema

Migrations: `20260916050000_external_ai_policies.sql`, `20260916051000_role_learning.sql`, `20260916060000_owner_intelligence.sql`. Additive columns on external connections/activity and training; new organization-scoped role requirements and analysis-run tables; RLS, explicit grants and checked RPCs; existing knowledge records retained. New learning/policy evidence columns are not browser-writable. Legacy APIs' permitted columns remain available.

UI: `components/app/ai-access-policy.tsx`, `learning-workspace.tsx`, `company-analysis.tsx`, `owner-intelligence.tsx`; AI detail, Team Learning, Home and Health; new analysis subroute. APIs: AI connection policy, learning activity/roles and company analysis. Services: external policy/retrieval/logging, knowledge impact permission intersection, learning practice/state, owner intelligence, company analysis and importer AI activity hook. Existing source-update cron adds bounded lookup retention cleanup. Guide gets controlled help, safe aggregate operational context and stable analysis/learning/AI access targets; no credentials or raw question transcript is passed into that context.

Motion uses existing shared components for local transitions; existing GSAP storytelling is unchanged. No dependency or environment-variable addition is required. Existing provider/OpenAI/cron/billing configuration is reused.

## Verification and visual evidence

- Actual migration SQL in isolated PostgreSQL: restrictive scopes/policies, stale/admin/tenant rejection, Premium guard, browser column privilege boundaries, unknown-routing preference, role requirements/current+future membership/revocation, version evidence, exact activity aggregation/deduplication, analysis leases/isolation, retention and recheck policy races.
- Actual services with deterministic boundaries: policy validation/exclusions, learning revisions, exact-quote feedback/no response storage, selected-source partial failure preservation, organization-filtered queries and safe owner navigation. Real model/provider calls are not substituted as success claims.
- Actual React component/browser fixtures at 1440/768/390: request payloads, stale-policy feedback, acknowledgement/practice, disconnected-source disablement, failed analysis/retry, owner metrics, reduced motion, no page errors/overflow. These are **not** authenticated Supabase E2E.
- Regressions: Phase 2 SQL/services, Phase 3 SQL/services, human-answer proposals, gap rechecks, external gap service and provider architecture/privacy assertions.
- Build/typecheck/lint are checked before release. Production schema validation executes migrations in a transaction ending in rollback, then independently verifies that new tables/columns are absent before actual rollout.

Screenshots in `artifacts/operational-platform/`: `phase-four-ai-policy-{1440,768,390}.png`, `phase-four-learning-{1440,768,390}.png`, `phase-five-analysis-{1440,768,390}.png`, `phase-five-home-{1440,768,390}.png`. Short interaction recordings: `phase-four-five-video/`. Source/analysis operations shown there use clearly isolated fixture data, not private customer examples.

Remaining validation: authenticated write/approval/provider/model E2E against a nonproduction database, real multi-session concurrency/pgvector ranking, deployed cron timing and model feedback quality. Production smoke uses read-only navigation/HTTP checks only—no synthetic customer data, external messages, model analysis or charges.

## Rollback

Keep the Phase 3 deployment as the application rollback target. Additive schema can remain; do not delete customer sources, drafts, assignments, history or newly approved knowledge. Capture old function definitions before applying replacements; this is a schema recovery aid, not a full Supabase backup. Restoring the old gap intake requires accounting for its private renamed implementation and the new trigger. Learning membership triggers and column grants require compatibility review before schema rollback. Any expired lookup logs removed by retention are not recovered by reverting application code. No automatic destructive down migration is provided.

Exact release deployment/migration verification is recorded separately in `docs/phase-four-five-release.md` after promotion.

### Live release follow-up

Read-only signed-in production checks confirmed Home metrics, Team Learning, selected-source Analysis and an existing managed AI policy editor, including 1440/390 overflow checks. No imports, approvals, assignments, policy saves or model calls were performed. Home initially emitted React hydration error 418: DashboardPulse initialized a local clock during server rendering and formatted it using the environment's time zone. Its initial label is now deterministic; local formatting starts after hydration via `useSyncExternalStore`. Actual component SSR/browser tests in Los Angeles and Tokyo pass. Final deployed Home uses the new release scripts and reports no new browser errors. Browser viewport overrides were reset.

The guarded `verify-external-ai.mjs` live E2E script was intentionally not enabled; its production-style fixture/write flow is not authorized by the read-only smoke plan. Live model/provider write journeys remain unverified. Vercel reported the shared server function artifact as approximately 2.14 MB versus 2.12 MB on Phase 3; no Core Web Vitals/slow-device benchmark is claimed.
