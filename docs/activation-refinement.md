# Activation refinement — implementation audit

The existing owner onboarding is a 2,503-line wizard with goals, knowledge locations, business tools, AI tools, connections, setup, teaching, testing and invitations. Business context is collected separately from workspace settings. Google has a contextual ConnectionAction in Teach, but onboarding's connection selection can send users to the catalog. Source review links also leave onboarding. Home replaces its entire dashboard with FirstRunWelcome until setup finishes. Guide measures pointer coordinates before layout settles and retains its previous location across routes.

Plan: replace the owner entry experience (preserve team joining) with five deterministic stages; reuse the existing capture, Google picker/import, process review and Ask services. Keep connection authorization inside source selection. Store the company profile on the workspace and resume from server state. Reuse visual source choices on Teach. Make Guide spotlight-first, with a short optional pointer after layout settles. Remove the first-use Home takeover. Do not deploy or apply production migrations.

Page purposes: Home prioritizes decisions and recent work; Ask asks a sourced question; Teach selects a source; Knowledge finds and inspects approved guidance; Needs You resolves a decision; Team manages people; Connections manages connection health; Settings manages workspace policy; Profile manages personal identity. Existing canonical managers, billing, permissions and knowledge services remain in place.

## Implemented

- Owner `/onboarding` now uses Goal → Company setup → Teach → Review → Try. Team joining retains its existing flow. Optional integrations and invitations are after activation, not gates.
- `components/onboarding/activation-onboarding.tsx` composes the existing capture/import, process approval and Ask APIs. A source is selected for review, approval waits for server confirmation, and completion checks the selected approved process and the current user's persisted answered question. No demo answer is shipped in the application.
- Google uses the existing contextual ConnectionAction/Nango sheet and Picker inside Teach. Selected imports return a process ID to onboarding instead of navigating to Connections or a review page. Existing organization-keyed Google pending-action storage supports return into this surface. Other optional usage connections are no longer part of core onboarding.
- CompanyProfileFields is shared with `/app/settings/company`. Canonical name, description, industry and size remain on organizations; optional details use company_profile JSON. Workspace General links to this editor instead of maintaining a second editable profile.
- TeachWorkspace shares source panels, official Google assets and the once-only GSAP TeachPipeline. Calls remain an optional normal-product entry. Processing no longer presents a simulated percentage or timer-driven extraction stages.
- Home no longer replaces the dashboard with FirstRunWelcome. The existing compact dismissible Guide setup strip links to resumable onboarding instead of launching a pointer tour.
- Guide retains Driver.js. Spotlight opacity is .48 with a stronger slate outline/halo. Targets settle before measurement. The optional pointer starts locally, disappears after a single short movement and is cancelled on scrolling/resizing. Multi-step guides do not use it; mobile/reduced-motion guidance remains spotlight-based. No libraries added.

## Files and routes

New: `lib/activation.ts`, `app/api/onboarding/activation/route.ts`, `components/onboarding/{activation-onboarding,company-profile}.tsx`, `components/onboarding/activation.css`, `components/app/teach-sources.{tsx,css}`, `components/app/settings/company-profile-form.tsx`.

Updated: `/onboarding`, `/app`, `/app/settings/[section]`, existing onboarding creation API, TeachWorkspace, TeachGoogle, CaptureProcess, SourceImport, ProcessReview, WorkspaceForm, settings navigation, Guide controller/spotlight/styles. Verification additions: `scripts/activation-ui-fixture.jsx`, `scripts/verify-activation.mjs`, `scripts/verify-activation-db.mjs`; existing Guide regression expectations now match the short-lived pointer.

## Database and release

`20260914020000_activation_company.sql` adds company_profile and activation_process_id plus a role-checked, revision-checked save_company_profile RPC. Existing nonempty company descriptions are preserved; empty descriptions are backfilled from legacy discovery. Legacy readers receive a mirrored description, not a second editable profile.

The migration has NOT been applied to production and this work has NOT been deployed. No new environment variables are required. Apply and verify the additive migration before releasing the application. For rollback, restore the prior application first and retain the additive fields; dropping them would lose saved onboarding/profile data. Do not blindly reverse the backfill.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, 105 generated pages.
- `npm run test:guide`: passed server/registry checks and browser checks at 1440, 768, 390, 360 and WebKit 430px. Covers route changes, missing-target recovery, resize, dismissal, role behavior and reduced motion with isolated adapters.
- `node scripts/verify-activation.mjs`: passed Chromium 1440/390/360 and WebKit 430; actual React components with mocked APIs. Exercises inline Google sheet, Explain → Review → Approve → sourced answer → completion, reload resume and overflow checks.
- `node scripts/verify-activation-db.mjs`: passed isolated PGlite migration tests for canonical persistence, revision conflict, organization isolation, member/anonymous denial, unknown fields and legacy compatibility. Not a production database test.
- Browser tooling fallback: local Playwright because the in-app browser tool was unavailable. No real customer data used.

## Screenshots

`artifacts/activation/` contains goal, company, teach, google-sheet, review, try, answer and complete screenshots at 1440, 390, 360 and 430px. These are rendered product components with synthetic workspace content, not live customer screenshots. Desktop Teach and mobile Review were visually inspected after settling animations. Guide verification captures its panel and spotlight separately.

## Remaining work / limitations

- Real-account new-workspace creation, Google consent/redirect return, Picker import and actual sourced AI answer still require end-to-end verification against a migrated environment. No live OAuth or external provider success is claimed.
- The existing approval service/editor is reused, including its existing concurrency semantics. This pass does not introduce atomic revision-bound approval or redesign the knowledge library/health/testbench.
- Review is focused on one source/process bundle, not a newly invented per-rule approval entity. Goal is saved but does not yet meaningfully rank source recommendations.
- Save/resume is server-backed after workspace creation; unsaved pre-creation company form drafts are not persisted across browser closure.
- Home retains its established decision/activity modules; cross-module Flip approval choreography and the wider requested analytics/event expansion remain follow-up work.
- No live Home/new-account screenshots or full-flow video were captured. Broader application end-to-end suite was not rerun in this pass.
