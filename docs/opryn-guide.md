# Opryn Guide

## Audit and implementation plan

The authenticated app uses Next App Router, Supabase membership/RLS, an organization-keyed AppShell, React local state, native DialogSurface, and scoped GSAP motion. Company questions already have a separate approved-knowledge answer service; Guide must not contaminate that corpus. Teach's ConnectionAction already persists its Google return path and owns OAuth/Picker. Team has real invitations and knowledge experts. Knowledge and Needs You share existing approval entities. Account settings already support personal reduced motion. No general product-help assistant or stable UI-target catalog exists.

Reuse these systems. Add Driver.js only for targeted highlighting/popover lifecycle; use its popover rather than introducing another positioning library. Reuse GSAP MotionPath and the server OpenAI Responses client. No new state manager or AI SDK.

Phases:

1. Typed product-help/target/guide catalog, tenant-scoped setup facts and validated AI intent endpoint.
2. Persistent shell utility, contextual actions, deterministic cross-route coaching, pointer, onboarding strip.
3. Target bindings, OAuth recovery, mobile/accessibility and failure tests. No deployment or production migration without approval.

Safety: Guide never clicks a business action, approves, invites, modifies permissions, or creates credentials. It only navigates to registered routes and highlights registered targets. Free-text answers are plain text, not HTML. Model choices are intersected with server-authorized targets. No DOM or company knowledge is sent to the model. Setup facts are queried under the current user's RLS; unavailable facts are unknown, never fabricated zeroes.

## Implementation

- `components/guide/opryn-guide.tsx`: persistent shell utility, page actions, optional tours, personal setup reminder, question composer, restart/back/exit, timeout recovery. Existing AppShell lazy-loads it; workspace changes remount it and cancel requests. Home's older checklist is replaced, not duplicated. The existing first-source learning screens remain intact and no longer hold activated workspaces behind an old onboarding flag.
- `lib/guide/registry.ts`: 18 typed targets, authored product documentation, 10 deterministic guides. Target IDs resolve exclusively to `data-guide` attributes. Every target has a route, title, description and role restriction where needed. The API exposes no JavaScript, selector, form-submit or credential tools.
- `lib/guide/schema.ts`: strict request and resume schemas, enum-constrained model responses, post-generation role validation.
- `app/api/guide/route.ts`, `lib/guide/server.ts`: existing Supabase membership/header checks, RLS-scoped facts, bounded request body, same-origin POSTs, existing OpenAI Responses/model configuration. Model failures return usable deterministic guidance. Company Ask and Guide remain separate.
- `components/guide/spotlight.ts`: lazy Driver.js **1.8.0**, existing GSAP plus MotionPathPlugin; 480ms curved desktop pointer, 180ms spotlight transition, semantic control anchoring, async target wait with 8-second timeout and cleanup. A human click hands control back to the application. Dialogs or disappearing targets end the overlay safely.
- `components/guide/guide.css`: slate surfaces, 400px desktop panel, full-screen mobile panel, reachable composer, focus states, low-opacity overlay, no mobile cursor. Launcher stays above mobile navigation and hides while a product field or provider dialog needs the space.

Existing target bindings: AppShell/Home, TeachWorkspace, KnowledgeLibrary, NeedsYouCenter, AskOpryn, TeamManager, KnowledgeExperts, Team roles link, IntegrationsCatalog, SettingsLayout. There is no second integration, approval, auth, or chat architecture.

### UI API

`GET /api/guide` returns the authenticated user/workspace/role and boolean-or-null setup facts. It returns no knowledge content, provider account secrets or teammate questions.

`POST /api/guide` accepts exactly one of:

```ts
{ action: "ask", question: string, path: string }
{ action: "show", targetId: RegisteredTargetId }
{ action: "start", guideId: RegisteredGuideId }
```

AI response: `{ message, suggestedTargets, guideId }`. Targets/guides must match enums and server permissions. The model cannot supply new steps, routes or selectors. The client asks the server to authorize each step again before navigating/highlighting it.

### Guides

`setup-opryn`, `teach-first-knowledge`, `connect-google`, `approve-first-item`, `invite-teammate`, `assign-expert`, `connect-ai`, `find-knowledge`, `review-needs-you`, `product-tour`.

Setup guides skip verified milestones and inaccessible steps. Other guides are instructional, not proof that a business action succeeded. Completing a tour never changes a product record.

### Setup facts

Core activation: a process prepared for review/approved; approved knowledge/process; a successful sourced Ask answer **for the current person**. Employees are guided toward Ask without owner tasks. Optional facts cover another member/pending unexpired invitation, authorized external AI/communication/MCP, Google connection and pending review items. Existing approved data, live invitations and active grants are used; clicking Next does not complete a milestone. Imported files are not counted as approved knowledge. Failed queries are `null`/unverified.

### OAuth and persistence

Only guide ID-equivalent steps, current index, user/workspace identity and timestamp are saved in versioned sessionStorage (24-hour expiry). No chat transcript, source content or tokens are persisted. Dismissal is a user/workspace-scoped localStorage preference. Storage-disabled browsers work in memory. This is device-local, not cross-device synchronization.

Teach's existing ConnectionAction remains responsible for OAuth/Picker and its return path. Guide survives full reload and offers the saved step after return; a verified Google connection produces a choose-files instruction. It **does not** launch a competing OAuth flow or automatically force Picker open. The product's existing resume mechanism may open Picker; otherwise the user chooses Show this step/Choose files. Provider dialogs take precedence over the spotlight.

### Accessibility

Native DialogSurface provides modal focus containment and restoration. Coach text and step counts are HTML; an aria-live region announces changes. Back, Next, Exit, retry, and skip-guidance are keyboard accessible. Esc exits the tour without changing product data. Pointer is decorative and hidden on phones/coarse pointers. OS/account reduced motion removes pointer travel and animated spotlight entry. No star/sparkle iconography was added.

## Database / release checklist

New migration: `supabase/migrations/20260914010000_opryn_guide.sql`. **Not applied to production.** It adds one counter row per user/workspace and a membership-checked atomic function allowing 60 AI questions/hour. No question text is stored. RLS is enabled; direct client table access is revoked. AI questions fail closed to deterministic help if the function is absent or the budget is exhausted. Repeated navigation/highlighting does not spend this budget.

No new environment variables. Reuse server `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL` and Supabase configuration. Before release: apply/test the migration in staging, exercise a real owner/member workspace, test Google OAuth/Picker with a consenting test account, and test real product-help answers. Then request production deployment approval.

Rollback: deploy the previous application; the additive counter table/function can remain unused. If removal is desired later, drop the function then the counter table in a reviewed migration; only temporary usage counters are lost. No existing knowledge data is migrated or rewritten.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- Existing Playwright suite plus Guide signed-out API test: **40 passed**, desktop + mobile, against a local production build.
- `npm run test:guide`: passes isolated real-component browser tests at 1440, 768, 430, 390, 360px (Chromium; WebKit at 430). Includes reduced motion, cross-route highlighting, keyboard focus, Esc, manual target handoff, reload/OAuth-style resume, tenant change, employee actions, Back/Next, real-state completion gates, and missing-target retry. No backend mutation was performed by Guide.
- Server adapter tests execute the real Guide route and auth wrapper with synthetic Supabase/model adapters: logged-out 401, workspace mismatch 409, restricted target 403, invalid actions/selectors, origin/body limits, scoped queries, failed data as unknown, rate limiting/missing migration, and unauthorized model-output rejection.
- Screenshots are **actual components with synthetic sample data**, not authenticated customer screenshots: `artifacts/guide/panel-chromium-1440.png`, `spotlight-chromium-1440.png`, `panel-chromium-390.png`, `spotlight-chromium-390.png`, and additional WebKit/tablet captures. Visual review caught and fixed Driver single-highlight mode hiding coach controls.
- No live OAuth authorization, invitation, approval, paid model call, or production database migration was executed. Live RLS and model correctness still need staging verification. Real screen-reader testing and mobile software-keyboard testing are not claimed.

## Deliberate limits / follow-up

No general form prefill/open-panel execution tools: users perform product actions. No persistent conversation history, cross-device tour sync, goal-preference storage, or Guide-specific analytics pipeline was introduced. Existing analytics did not expose a suitable product-event sink. Expert-only delegated approval tours are conservatively omitted for employee roles; employees retain their existing product permissions outside Guide. Complex item-specific tours can extend the authored registry rather than granting model DOM control.

Dependency installation reported 28 repository advisories (including one critical); this change did not run a broad/breaking dependency upgrade. Review these separately before a production release.

Official API references used: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Driver configuration](https://driverjs.com/docs/configuration), [GSAP MotionPath](https://gsap.com/docs/v3/Plugins/MotionPathPlugin/).
