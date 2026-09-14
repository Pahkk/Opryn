# Authenticated product upgrade — staged audit

## Baseline (12 September 2026)

The production app uses Next.js App Router, Supabase Auth/Postgres/RLS/private storage, Stripe, Nango, and existing Opryn knowledge/approval services. Preserve these. Authenticated CSS has an established blue primary color; the public green marketing theme is not the product theme.

### Working

- Organization membership checks, owner/admin/employee roles, full navigation on workspace switch, organization-keyed shell.
- Google contextual Teach action, resumable OAuth intent, selected-file Picker, partial import retry, review links (provider interaction still needs real-account testing).
- Knowledge overview, server pagination, lexical/semantic search, filters, preview and canonical process editor; proposal revision checks and approval events.
- Member invitations/resend/revoke, role assignment, scoped expertise, training; Stripe portal and real subscription state.
- Nango ownership/webhooks; API/MCP permission controls and revocation; exact notification entity links.

### Gaps found

- Settings requires admin even for personal needs, uses hash navigation into an overlong mixed form, and promotes only Twilio instead of canonical Connections.
- Profile menu only signs out; sidebar account label unexpectedly signs out too. No editable profile or persistent personal settings.
- Global search is hidden on phone; Settings is absent for employees. Workspace switch discards edits without a warning.
- Settings logo/delete and billing portal can stay busy after a network exception. Workspace updates span two non-atomic writes and have no revision check.
- No personal notification controls; generated question/invitation reminders mixed with persisted notifications. No personal digest/email infrastructure beyond invitations.
- Member removal does not surface assigned questions or source/knowledge responsibilities. Existing owner role cannot be removed through UI, but sensitive operations need stronger database guards.
- Knowledge category currently mixes subject and type. Saved views, owner-authored test cases, change-impact analysis remain separate follow-up work.
- No configured active-session inventory, self-service ownership transfer/account deletion, MFA enrollment, comprehensive audit export, or retention scheduler. Do not imply these exist.

## Phases and release gates

1. **Foundation**: task navigation, searchable/deep-linked Settings with server permission checks, useful private account/profile/preferences, enforced in-app notification preferences, safe existing member/workspace management and billing routing. Mobile, persistence, permission and recovery tests before production release.
2. **Core loop**: separate subject/type taxonomy with safe migration; saved views/navigation state; editor/revision and exact review notification checks; preserve contextual Google Teach.
3. **AI context**: real access/readiness details, owner-reviewed knowledge testbench using existing retrieval, observed change impact and role-based learning.
4. **Hardening**: cross-tenant/concurrency/permission tests, provider-connected task testing, keyboard/mobile/performance audit. Run relevant checks during every phase, not only at the end.

Ship a complete phase rather than partially rewriting every route. Do not change prices or replace providers. Deployment is explicitly authorized by the owner after validation. Additive migrations first, candidate build and checks, then promotion; retain previous release.

## Verification boundaries

Component browser fixtures exercise real components with explicit mocked APIs. Isolated database tests exercise actual SQL/RLS without production customer data. Neither proves real Google OAuth, email delivery, Stripe changes, or an external agent's final response. Never perform those customer actions automatically.

## Foundation implementation

### App and Settings routes

- `/app/settings`: searchable section index. Account sections are available to every signed-in member; workspace sections require owner/admin access on the server, including direct URLs.
- `/app/settings/profile`: saved display name, private cropped avatar upload/replace/remove, verified-email status and current membership. Job/access roles are not freely editable personal fields.
- `/app/settings/preferences`: account-only density, reduced motion, date format and timezone. Date format/timezone currently apply to Settings activity and the account preview, not every historic date component in the app.
- `/app/settings/notifications`: in-app assigned-question, review and answered-question preferences. These filter real event types, do not remove Needs You tasks, and do not suppress connection/security warnings. No pretend email/digest controls.
- `/app/settings/security`: actual auth methods, verified password recovery only for email identities, supported Supabase other-session refresh revocation. No fake session inventory or MFA toggle.
- `/app/settings/general`, `/knowledge`: focused, revision-checked workspace forms; atomic changes and recorded events. Workspace timezone applies to activity unless a personal timezone was selected. Names are display labels, not fictitious custom slugs.
- `/app/settings/members`, `/connections`: canonical manager redirects, not parallel management implementations.
- `/app/settings/billing`: existing Stripe behavior, true plan/status/renewal/seat configuration, explicit pending-invite seat usage, retryable portal errors. No pricing changes.
- `/app/settings/data`: honest source/retention information and support-assisted data requests. The old database-only workspace deletion was disabled because it did not coordinate billing, storage or external access. No customer data was deleted.
- `/app/settings/activity`: paginated settings and knowledge events, explicitly not an exhaustive security audit.
- `/app/help`: real product destinations and `usersupport@opryn.app`.

Main navigation stays Home / Ask / Teach / Knowledge / Needs You / Team / Connections. Settings and Help are quieter; Profile and account actions are in the avatar menu. Global knowledge search works on mobile and with the keyboard shortcut. Settings search is explicitly scoped.

Workspace switching keeps full navigation and clears router state; Settings forms warn before abandoning edits. Workspace API requests carry the mounted workspace ID and the server rejects stale-tab mismatches. Other tabs reload on a workspace change; cancelling the unsaved-work warning leaves old-tab mutations blocked until reload. Personal preferences remain independent of workspace selection.

### Main source files

- Shell/context: `components/app/app-shell.tsx`, `lib/app-context.ts`, `lib/api.ts`, `app/app/layout.tsx`, `app/globals.css`.
- Settings components: `components/app/settings/{settings-layout,account-forms,workspace-form,form-state,primitives}.tsx` (form-state is `.ts`), `settings.css`; route files under `app/app/settings/`; `app/app/help/page.tsx`.
- Account model/server reads: `lib/account-settings.ts`, `lib/account-settings-server.ts`, `lib/settings-navigation.ts`, `lib/request-origin.ts`.
- APIs: `app/api/account/route.ts`, `app/api/account/avatar/route.ts`, `app/api/settings/{route.ts,workspace/route.ts,logo/route.ts}`, member management route, billing portal route.
- Reused management: `components/app/team-manager.tsx`, `app/app/team/page.tsx`, `components/app/billing-settings.tsx`.
- Theme alignment: `components/app/knowledge-library.css` uses the existing authenticated blue tokens. Public marketing styles and official logo are unchanged.
- Image validation: explicit `sharp` dependency, existing installed version; lockfile updated. Profile photos decode/crop/re-encode to 256px WebP, strip metadata, reject unsupported/spoofed files, enforce 3 MB upload/25 MP decoded limits. Workspace logos use the same validated re-encoding approach at 512px.

### Migration and rollback

`supabase/migrations/20260912020000_account_foundation.sql` adds private `account_settings`, self-only read/storage policies and revision-checked save functions; creates private `account-avatars`; adds organization description/default timezone and settings revision; records workspace settings events. An explicit saved name survives subsequent OAuth provisioning. Existing account records are not rewritten; defaults apply until the user saves.

Member removal now checks current assigned unanswered questions, expertise and person-owned active connections in the same database operation. Owners cannot be removed. Direct authenticated deletes on organization members are revoked, as are database-only organization deletes. Removal may require reassigning expertise/questions or reconnecting/disconnecting sources first. There is no invented ownership-transfer workflow.

The migration adds fields/tables/functions and tightens permissions; it does not drop or rewrite customer knowledge. Apply the tested migration before promoting schema-dependent code. Keep it on rollback: dropping it would discard newly saved profile/preferences/history. The previous app remains read-compatible, but its legacy member-removal route will not bypass the new direct-delete restriction. Prefer a forward fix; restoring the old delete grant would require an explicit security review. Workspace deletion remains support-assisted.

### Validation

- Typecheck, lint and production build passed.
- `verify-account-foundation.mjs`: 59 assertions, actual isolated SQL/RLS plus explicit API identity doubles; private preferences/storage, revision conflicts, cross-tenant/admin checks, removal guards, legacy writer invalidation and real notification type filtering.
- `verify-avatar.mjs`: 16 assertions, real image decoder/crop/re-encoding with mocked identity/storage; invalid and oversized files, private cache headers and conflict cleanup.
- `verify-settings-ui.mjs`: 100 real-component browser assertions at 360/390/430/768/1440px; profile/preference persistence against mocked responses, search/dirty state, stale saves, retry, Google-only account security, mobile overflow and keyboard search.
- Existing product UI: 230 assertions at 320/375/390/430/768/1280/1440px, including contextual Google teaching, library and approval flows with explicit provider/API doubles.
- Existing knowledge-library, Nango lifecycle/webhook, process-approval, proposal-decision concurrency, product-workflow and file-learning suites passed. Communication architecture static checks passed.
- Graphify AST graph refreshed. No production test users, real Stripe changes, real provider authorizations or customer messages were created.

Screenshots (real components, synthetic account data): `artifacts/settings-foundation/profile-1440.png`, `profile-390.png`, `general-1440.png`, `general-390.png`, plus preferences, notifications, security, billing and Settings index at both widths. Existing core-loop screenshots remain in `artifacts/product-ux/`.

### Limitations and next stage

No new OAuth/API credentials are required. The database migration and private bucket must exist before the app runs. Existing Supabase password-recovery email configuration, Google consent/Picker, and Stripe portal configuration remain prerequisites and were not exercised with real accounts in this run. Actual Safari/iOS keyboard behavior and real-account reload/persistence still need a controlled staging task check. Browser component fixtures are not proof of live external integrations or WCAG certification.

Email changes/linking, MFA enrollment, session inventory, ownership transfer, comprehensive exports and coordinated account/workspace deletion remain support-assisted or unimplemented—no working-looking placeholder controls were added. Pending avatar changes and non-Settings editors do not yet share the full unsaved-Settings navigation guard. Workspace/source writes made outside the Settings API are not represented as a complete audit trail.

**Next: Phase 2**, separate subjects from knowledge types, saved views/navigation-state preservation, editor revision refinements and decision-queue/deep-link hardening. Phase 3 adds the owner-reviewed knowledge testbench and observed change impact. These are not claimed complete by this foundation release.

## Deploy result — 12 September 2026

- Public application: https://www.opryn.app/app/settings
- Target: production. Status: READY, promoted and custom domain verified.
- Deployment: `dpl_BfkpptHbcKiYcPfpenaANi4d1CpJ`, https://handoff-20lawcad4-nikitas-projects-acfaddb7.vercel.app
- Source: working-tree snapshot based on `fe02268` (includes existing uncommitted work; no commit or branch reset performed).
- Framework: Next.js 16.3.5. Remote build completed in 49 seconds.
- Migration `20260912020000` applied successfully. Verified live: private bucket, three avatar policies, account RLS enabled, anonymous save denied, authenticated revision-save grants present, direct personal edits/member deletes/workspace deletes disabled. The CLI's optional local Docker catalog-cache step warned because Docker was not running; the remote migration and schema verification succeeded.
- 13 live smoke checks passed: public/login/signup/pricing/security pages, protected Settings/Help redirects, and signed-out account/avatar/workspace/capability API denial. No authenticated customer settings or billing actions were changed as tests.
- Initial deployment-specific error scan (`--level error --since 15m`) returned no entries. This is a small release smoke window, not proof of every authenticated workflow. Log drains/ongoing external monitoring were not audited or reconfigured.
- Rollback target retained: `dpl_jSBkhkv2HhA4Eb64jL9iS96ejvHd`, https://handoff-bu72mjruz-nikitas-projects-acfaddb7.vercel.app . Preserve the new schema if rolling back; see the tightened-delete permission caveat above.

For reproducible isolated SQL tests, provide `OPRYN_PGLITE_MODULE` pointing to an installed `@electric-sql/pglite` module. This run reused the existing temporary verification installation, not a live database. Browser fixtures use the project's Playwright and existing esbuild installation.
