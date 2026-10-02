# Operational platform status — Phase 1 implementation progress

This is **not the completed five-phase upgrade**. Phase 1's continuation was released on 2026-09-16 with explicit owner approval to deploy and preserve current icons. Six continuation migrations (including default-privilege hardening) are applied. Full authenticated real-model/provider E2E remains unverified, so this is not a claim of production end-to-end certification.

## Originally released subset (historical)

- Reused question_clusters as gap identity; added a security-invoker company_knowledge_gaps projection with six lifecycle states, normalized question, observed people/channel/interruption counts and representative questions. Added optional classification and resolved-knowledge linkage.
- Needs You identifies actionable questions as knowledge gaps, uses actual source-channel labels and shows recurrence factors to authorized admins. No second inbox or top-level page was introduced.
- Narrow multi-word expert areas now win over broad category matches; existing exact knowledge assignments and membership/access guards remain in place. A non-match retains existing owner/admin fallback behavior.
- submit_human_answer atomically submits an answer and creates a real pending knowledge_proposals record, provenance, review notifications and interaction resolution. A pending proposal does not resolve its gap and cannot publish policy.
- Proposal submission is idempotent; a completed answer's intent cannot be switched on retry. Assigned experts are authenticated and checked independently of UI visibility. Cross-organization IDs are rejected.
- Explicit one-time exceptions remain interaction data, cannot be turned into proposals through client flag manipulation and do not populate reusable guidance.
- Stored human-answer edits now update the actual answer; conditional writes prevent editing submitted history. Network failures restore usable controls.
- OwnerAnswer uses Create knowledge proposal for reusable answers, including owner answers. Existing explicit-authority legacy approval endpoint behavior is retained for compatibility, not invoked by the new UI.
- Guide's controlled documentation describes gaps, proposals, expertise and one-time answers without advertising planned Testbench/analysis features as available.
- Ask Opryn, Slack and Teams unknowns automatically enter the existing routed question workflow when workspace escalation is enabled. MCP additionally requires its escalation scope. An uncited Ask response becomes an unknown instead of an opaque error. Ask shows already-routed status.
- The existing proposal decision transaction queues recorded question rechecks on approval. Next.js after runs a bounded batch without delaying committed approval. Atomic server-only claims suppress duplicate/parallel model work with a five-minute retry lease.
- Rechecks use the original actor's role-aware retrieval, the existing conflict/trust gate, actual conversation context, current knowledge version and normal/critical confidence thresholds. At least the newly approved knowledge must be cited. Original image-dependent questions remain unknown rather than being certified from text alone. No fake questions, delivery or time-saved events are generated.
- Server-only completion verifies current source trust, organization, original membership/access and approved version again. All recorded questions must be verified before cluster closure. Unknown/error or additional unverified questions prevent closure; a failed repeat verification reopens a gap previously resolved by that item. Dismissed clusters stay dismissed.
- Cluster occurrence counts must match recorded team/MCP interactions before automatic closure: external or not-yet-recorded occurrences cannot be certified by those team answers. High-impact human proposals retain critical risk metadata and its stricter answer-confidence threshold.
- Failed/unknown rechecks and jobs stalled for five minutes surface in Needs You, with Recheck questions and the canonical Teach route. Ordinary pending work is not presented as a human decision. The existing thinking-orbs wrapper appears only for real answer structuring/rechecking, not SQL submission.
- Existing external AI escalations are surfaced in Needs You and link to their actual connection workflow. No synthetic employee identity or duplicate interaction is created. Their approval/recheck implementation remains separate (see limitations).
- Notification routing retains the canonical trigger. Repeated questions suppress another unread alert for the same cluster/recipient within 24 hours; expert recipients do not additionally interrupt owners.

## Changed files/routes

Existing routes: questions/[id]/answer, questions/[id]/resolve and api/ask. New route: POST /api/knowledge-proposals/[id]/recheck. Existing services: shared proposals, communication answers and MCP answers. Existing UI: OwnerAnswer, Ask Opryn and Needs You aggregation/detail. New component: gap-recheck. Guide: operational-help and server instructions. Five additive migrations: 20260916010000, 20260916011000, 20260916012000, 20260916013000, 20260916014000. Test scripts: verify-human-answer-proposals, verify-human-answer-ui, verify-gap-rechecks and verify-gap-recheck-service. Internal plan: operational-platform-plan.md.

No new dependencies were added to the application. PGlite/esbuild verification tooling was installed in a temporary directory only. Public homepage, branding, GSAP, pricing, trial/billing and provider credentials were not changed.

## Verified evidence

- Isolated PostgreSQL executes the migrations/functions and checks authentication, organization isolation, assigned-expert authority, pending-only proposals, provenance, idempotent retries, exception safety, atomic rollback on notification failure, RLS gap visibility, lifecycle states and specificity routing.
- Chromium renders explicit component fixtures at 1440px and 390px. Tests check proposal/one-time request payloads, no horizontal overflow and no browser errors. Screenshot paths: artifacts/operational-platform/human-answer-1440.png, human-answer-390.png, one-time-390.png. These are **fixtures, not authenticated application screenshots**.
- The real gap-recheck migration executes in isolated PostgreSQL. Checks cover queue creation, idempotent trigger behavior, claims/cooldown, all-question closure, unknown/errors, source versions/conflicts, org isolation, RLS and notification suppression. The service test bundles the actual service and trust gate with deterministic provider/query fixtures: original-actor retrieval, history, critical confidence, fabricated citations, disabled/restricted access, image context and model failure.
- Browser fixtures also test Recheck questions, restored controls after a failed request, successful unknown response messaging, genuine-work orb container and the canonical Teach link. Additional screenshots: gap-recheck-1440.png and gap-recheck-390.png. No real provider or authenticated backend is involved.
- Typecheck, lint and production build passed after the implementation changes. No real OAuth import, provider update, model-backed approved answer or production database journey has been tested for this upgrade.

Reproduce SQL checks with OPRYN_PGLITE_MODULE pointing at an installed @electric-sql/pglite dist/index.js. Reproduce UI checks with OPRYN_ESBUILD_MODULE pointing at esbuild/lib/main.js after npm run build.

## Phase 1 continuation — implementation and verification

- One unified recheck queue now supports real external escalation identities alongside employee/MCP questions. Mixed-channel closure requires current verified answers for every recorded interaction and fails closed when occurrence counts do not match. Original connection/key, live billing, scopes, selected access, current sources and version are checked server-side; no synthetic employee or administrator retrieval is used.
- External unknown answers create real interaction records. Explicit escalation attaches to the same key's recent matching unknown instead of double-counting it. Assigned experts can answer inline in Needs You; publishing still creates pending canonical proposals. A key-scoped GET `/api/v1/escalations/[id]` returns interaction-specific human responses, explicitly not current approved policy; consumers must ask again for fresh approved guidance. No unsupported proactive adapter delivery is claimed. Legacy escalations without an origin key fail closed for polling/recheck.
- Assigned experts/admins can request clarification and dismiss with an audit reason. Only admins can reroute to a member of the same workspace. Original askers reply to the exact clarification in Ask Opryn. Clarifications remain situational context, not approved authority. New child-table RLS prevents arbitrary writes and unrelated readers.
- Team ownership authoring supports category, subject, tag, process and business area. Exact knowledge/process/tag context and specific multi-word areas determine routing, retaining owner/admin fallback and existing publishing authority. Process selections validate tenant and approved state.
- Workspace advisory transaction locks serialize cluster lookup/create; the existing conservative 0.84 similarity threshold remains. Explicit one-time exceptions are separated and external interaction exception flags cannot be removed through a client flag. Vector semantics and concurrent sessions are not certified by fixture tests.
- Existing daily external-learning cron independently recovers pending/transient-error rechecks. Atomic claims process at most ten of each channel per proposal, two proposals per worker invocation, with 15-minute cooldown and three automatic attempts. Unknown answers require human action rather than endless model retries. Manual retry remains available. No new cron schedule, environment variable or app dependency.
- Guide documentation now describes these implemented controls without advertising Phase 2–5 features.

### Continuation files and migrations

Applied continuation migrations: `20260916020000_external_gap_rechecks.sql`, `20260916021000_gap_question_controls.sql`, `20260916022000_expert_ownership_and_clustering.sql`, `20260916023000_external_gap_intake.sql`, `20260916024000_gap_projection_channels.sql`, `20260916025000_clarification_privilege_hardening.sql`.

Services: `external-gap-rechecks.ts`, `recheck-runner.ts`, existing team rechecks/proposal approval. Routes: question manage, proposal recheck, external answer/intake/escalation polling, existing external human answer and team experts. UI: GapQuestionActions/ClarificationReplies, Ask, Needs You, existing EscalationCard, KnowledgeExperts and Team. No pricing, OAuth credentials or homepage changes.

### Continuation verification

Eight SQL/service checks pass, including the original human-answer/recheck regressions plus real mixed queue validation, real question controls, external intake/expert/proposal/projection SQL and actual external service with deterministic provider fixtures. Intake's vector type/operator is substituted in the isolated fixture; this test does **not** certify pgvector distance or multi-session concurrency. Typecheck, lint and production build pass. Browser fixtures at 1440/390 verify reroute payload, pending clarification, exact reply identity, failed-request recovery, non-admin controls, overflow and console errors. Screenshots: `artifacts/operational-platform/gap-controls-1440.png`, `gap-controls-390.png`, `clarification-reply-1440.png`, `clarification-reply-390.png`. These are component fixtures, not authenticated app screenshots. Original human/external answer browser regressions are retained.

Remaining validation: full authenticated real-model/provider journey, real pgvector semantic/concurrency behavior, and deployed scheduler timing. The owner chose fixture-based work instead of Docker/staging; deployment approval does not authorize production fixtures.

Rollback: revert continuation application paths before rolling back schema. Migration 200 changes the queue primary key and wraps/renames its verifier; do not drop it blindly while dependent workers are active. Preserve queue evidence, proposals, answers and audit history. New columns/tables may safely remain during app rollback; function restoration requires a reviewed compatibility script. No customer knowledge should be deleted.

### Continuation production release — 2026-09-16

- Explicit owner request: deploy and keep the current icons. Built the existing working tree without changing icon artwork/UI. No new Git commit was created (HEAD `c30317c`).
- Vercel READY deployment `dpl_FSjgdMmkL5Hyk7EK252N7pPssWG7`: https://handoff-5cbuuwa9a-nikitas-projects-acfaddb7.vercel.app, promoted to https://www.opryn.app after build and staged smoke checks.
- Previous production rollback target: https://handoff-4apcwdhmv-nikitas-projects-acfaddb7.vercel.app (`dpl_EqQ2b1a45QbiAyZo7cNu7a3MN1Un`). Keep the additive schema/customer data during application rollback.
- Checked production columns and migration history. Executed the five continuation migrations inside BEGIN/ROLLBACK; independently confirmed the new table/column were absent afterward. Captured replaced function definitions in `artifacts/operational-platform/continuation-functions-before.sql` (schema recovery aid, not a full backup).
- Applied migrations 200–240. Live default table privileges granted direct-write privileges despite RLS's lack of write policies; applied migration 250 to explicitly revoke anonymous/authenticated privileges and restore authenticated SELECT only. Verified RLS enabled, anonymous SELECT denied, browser INSERT/UPDATE denied, and browser intake/verification functions denied.
- Knowledge/proposal/question/external/recheck counts remained 144/5/38/0/0. No production fixtures, model test calls, charges or customer knowledge mutations were performed.
- The CLI emitted a Docker local-catalog caching warning after successful remote application; remote migration records were independently checked.
- Preserved icon assets: live favicon.ico, favicon-48x48.png and apple-touch-icon.png return 200 with correct MIME types and byte-for-byte SHA-256 matches to existing local artwork. These URLs returned 404 on the preceding production release. No icon redesign.
- Live smoke: homepage/login 200; authenticated Ask/Needs You redirect to login (307); question-manage and external escalation polling reject unauthenticated requests (401). This is HTTP smoke evidence, not authenticated end-to-end validation.

## Remaining phases

Phase 2: Testbench, consumer simulations, saved expected outcomes, reusable scopes and all-surface scope enforcement. **Released with approval; see the Phase 2 release section below.**

Phase 3: Source freshness, guarded conflict decisions/replacement, source/version comparisons, and Change Impact are **deployed with user approval**. Four migrations are applied and independently verified. See `docs/phase-3-delivery.md` for implementation verification and `docs/phase-three-release.md` for production details; real authenticated provider/model E2E is not certified.

Phase 4: Restrictive managed external-AI policies, unknown-routing preference, item/version logs/retention and current-version role/process learning with optional sourced practice are **deployed with owner approval**. OAuth MCP retains its separate existing access model. See `docs/phase-four-five-delivery.md` for scope/limitations and `docs/phase-four-five-release.md` for verified deployment details.

Phase 5: Real activity aggregation, transparent returned-time estimates, evidence-led recommendations and explicitly selected-source company knowledge analysis are **deployed with owner approval**. Existing events/knowledge extraction are reused, not duplicated. See `docs/phase-four-five-delivery.md` and `docs/phase-four-five-release.md`.

## Deployment/migration gate

Initially, the owner selected fixture-based implementation without Docker/staging and prohibited production changes. On 2026-09-16, after being told deployment required six production migrations, the owner explicitly approved applying them and deploying. All six migrations are now recorded in the linked production database. This authorization does not imply the remaining phases are complete or permission for unrelated future database changes.

Rollback considerations: disable/revert the new application paths first. Preserve any created proposals, answers and audit trail. New columns are additive and can remain during application rollback. Remove the dependent gap view/functions before considering column removal; never delete customer knowledge as rollback.

## Continuation: external human-answer safety

Changed the existing external AI escalation answer route, AI connection detail loader and EscalationCard. Added `20260916015000_external_answer_proposals.sql`, `verify-external-answer-proposals.mjs` and `verify-external-answer-ui.mjs`. The authenticated owner/admin API retains its existing billing gate. The transactional RPC independently checks admin membership, organization and connection ownership; its authenticated grant matches existing admin access to external escalation resources. No employee actor/question is fabricated.

External submissions lock the real escalation, create one pending canonical proposal with source provenance, audit event and review notifications in the same transaction, and retain idempotent disposition. They never write approved chunks/versions directly or mark clusters resolved. UI wording says Create knowledge proposal, links to Needs You, restores controls on failure, aborts on unmount and supports explicit one-time exceptions. The proposal reference is loaded on resume/refresh.

## Production release — 2026-09-16

- Live URL: https://www.opryn.app. Vercel READY deployment: `dpl_2QowCposGUkL5SVbW2fUNuyv2EtY`, https://handoff-mgcltytjb-nikitas-projects-acfaddb7.vercel.app. Deployed the current working tree, not a newly created Git commit.
- Before promotion, checked migration history, actual production columns and notification trigger. All six migration SQL files were executed inside a transaction ending in ROLLBACK, then rollback was independently confirmed. Original replaced function definitions are saved in `artifacts/operational-platform/production-functions-before.sql`.
- Supabase Free reported no available managed physical backups. The function snapshot is a schema recovery aid, **not a full database backup**. No customer data was exported.
- Applied only migrations `20260916010000`, `20260916011000`, `20260916012000`, `20260916013000`, `20260916014000`, `20260916015000` using linked database push. Independently verified their history records, enabled recheck RLS and denied anonymous submission/browser recheck verification privileges.
- Existing counts remained unchanged across migration: 144 knowledge chunks, 5 proposals, 38 employee questions. The gap view reads 10 existing clusters. No test fixtures or synthetic records were inserted into production.
- Supabase reported a Docker warning while caching its local migration catalog after successful application. All remote migration records were verified independently; Docker was not required for this release.
- Local build/typecheck/lint, isolated human/external answer SQL and recheck SQL/service tests, external UI desktop/mobile fixtures and communication architecture checks passed. Remote Vercel build passed before promotion.
- Live HTTP smoke: homepage/login/pricing/favicon return 200; authenticated Needs You/AI Connections redirect unauthenticated visitors to login (307); proposal recheck and external answer POST endpoints reject unauthenticated requests (401). Vercel error-log scan for the new deployment returned no logs at release time. This is not long-term monitoring or a full authenticated/model-backed journey.
- Application rollback target if needed: previous production deployment https://handoff-5vrsl61mx-nikitas-projects-acfaddb7.vercel.app. Preserve additive schema and customer records during an application rollback; restore captured functions only after compatibility review.

The new isolated SQL test executes the migration and covers admin/tenant/connection isolation, critical risk, pending-only state, provenance, duplicate retries, contradictory dispositions, one-time exception safety, notification failure rollback and dismissal. Browser fixtures exercise the real component at 1440/390, proposal request/link, error recovery and answer-only exception payload. Screenshots: `artifacts/operational-platform/external-answer-1440.png` and `external-answer-390.png`. These are component fixtures, not authenticated application evidence.

## Phase 2 — released with user approval, 2026-09-16

Test Opryn, saved deterministic expectations and scope-aware approved guidance are deployed at https://www.opryn.app, Vercel READY `dpl_5unruHnaWWrdJDQjx4toL8esQfTi`. Four additive migrations (`20260916030000`–`20260916033000`) were validated in a rolled-back transaction before application and independently verified. No production fixtures were added; existing counts were unchanged. Actual SQL/service modules and React components have isolated fixture verification; production/authenticated real-provider E2E is not claimed. See `docs/phase-2-delivery.md` for routes, scope/version safeguards, rollout/rollback constraints, screenshots and remaining environment requirements. Current icons and business configuration are preserved.
