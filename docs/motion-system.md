# Opryn motion system

## Audit and decisions

The app uses Next.js App Router, React 19, shared native dialogs, and an existing CSS animation vocabulary. There is no Framer Motion dependency. GSAP 3.15.0 was already installed in the preceding package-install task. This pass uses core GSAP only: no plugin registration, ScrollTrigger, routing interception, new animation dependency, or global GSAP defaults.

The audit covered AppShell, DialogSurface, TeachWorkspace/TeachGoogle, KnowledgeLibrary, NeedsYouCenter, IntegrationsCatalog/NangoConnection, TeamManager, OnboardingShell, Settings components, and StoryHome. Repeated CSS page/dashboard/drawer/provider entries were overlapping. Some legacy connectors and marks looped continuously. The shared native dialog must yield its top layer to Google Picker; transforming or retaining that top layer would break the workflow.

Public marketing keeps its green theme; authenticated screens keep their established blue interaction color. Simple hover/focus/selection and onboarding progress use CSS. The existing pausable typing/demo playback remains responsible for those behaviors; GSAP does not create a second playback engine.

## Shared implementation

- `lib/motion/presets.ts`: durations (150/210/300/460ms), ease and distance tokens, capped stagger.
- `lib/motion/reduced-motion.ts`: OS plus saved account preference; observes changes and page visibility.
- `lib/motion/gsap.ts`: scoped `gsap.context()` lifecycle, event/observer registration, failure-safe revert, no server credentials or business state.
- `components/motion/motion-region.tsx`: page/quiet/step/status entry without keyed child remounts; immediate error opt-outs; changed-key row entries with a maximum 150ms total stagger.
- `components/motion/flow-line.tsx`: thin, accessible decorative SVG connector, drawn once on entry. HTML labels retain all meaning.
- `components/motion/motion-number.tsx`: real initial values and old-to-new confirmed counts; stable screen-reader value, no count-up from a fictitious zero.
- `components/motion/motion.css`: removes overlapping entries and decorative mark/path loops, preserves CSS micro interactions.

Lifecycle follows [GSAP context cleanup](<https://gsap.com/docs/v3/GSAP/gsap.context()/>). Each hook owns its cleanup; asynchronous viewport callbacks register through that same scope. No ScrollTriggers, permanent `will-change`, global scroll handlers, infinite GSAP timelines, or generated artwork.

## Product behavior

| Surface        | Change                                                                                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App content    | 300ms, 12px entry; shell/nav do not animate on route changes. Settings uses a 150ms fade. Billing/security/data opt out.                                                                                                                                                        |
| Native details | 300ms inner-surface entry; top-layer dialog itself stays untransformed. Small desktop entry stays inside viewport bounds. Mobile uses a 24px vertical entry. Navigation sheets stay stable.                                                                                     |
| Knowledge      | Only inserted/changed keyed result rows animate. Search, URLs, pagination, revisions and detail data are unchanged.                                                                                                                                                             |
| Needs You      | Status appears only after the existing server-confirmed decision. Count changes animate from the previous real value. Completed rows retain their space for pointer safety; explicit “Clear completed decisions” collapses them in 210ms with a bounded state-cleanup fallback. |
| Teach / Google | Thin Teach → Review → Approved connectors, persistent source selection styling, selected-file stagger; no Connections detour, fake stages, timers claiming import completion, or automatic approval.                                                                            |
| Connections    | Confirmed success/Manage action fade, selected file entries, finite connection line instead of a perpetual progress loop. Third-party logos stay still.                                                                                                                         |
| Team           | Added members/invitations enter; unchanged rows/avatars stay stable. Invitation uses the shared native dialog so page transforms cannot trap it.                                                                                                                                |
| Onboarding     | Small step entry; progress uses transform rather than animated width; no new child remounts from animation.                                                                                                                                                                     |
| Settings       | Quiet entry and server-provided saved messages; errors are immediate. Sensitive settings opt out through `data-motion-immediate`.                                                                                                                                               |
| Homepage       | Coordinated hero entry completes around 700ms; sections/images/diagram paths reveal once using the existing IntersectionObserver structure. No pinning or scroll hijack.                                                                                                        |

Routing does **not** retain old private page content for an exit animation. Dialog dismissal is immediate rather than delaying cleanup/focus restoration or retaining a suspended Google host. Those are intentional reliability decisions, not simulated page transitions.

## Accessibility and recovery

HTML/CSS content starts visible. Reduced motion skips GSAP transforms, stagger and path drawing entirely. Changing OS/account preference or hiding the document reverts active motion. Errors, invalid fields and explicitly marked critical content interrupt page/dialog entry. Large lists have capped animation time. Actions stay usable during motion.

GSAP does not change permissions, knowledge status, connection health, network requests, OAuth state, approval revision checks, or React-owned form data. No schema, migrations, environment variables, or deployment changes.

## Verification

Use `node scripts/verify-motion-ui.mjs` after a production build. It renders real GSAP and React in StrictMode at 360/390/430/768/1440px. Checks include rapid state/filter changes, unchanged rows, unsaved inputs, OS/account motion preference changes, errors, keyboard dismissal/focus, repeated dialog opening, explicit hidden-page events, unmount cleanup, intentional animation failure and 4× CPU throttling. These are local fixture tests, not live Google or customer data tests.

Existing product and Settings browser harnesses exercise real components against explicit API/OAuth doubles. The product harness now blocks Google's real SDK preload so it cannot race with and replace its Picker double. Public homepage tests run against the actual local production build. No production account, billing, approval, provider connection, or data mutation is used for QA.

Screenshots: `artifacts/product-ux/`, `artifacts/settings-foundation/`, `artifacts/editorial-home/`, `artifacts/motion/`. Still screenshots verify settled layout, not motion timing; the lifecycle tests verify timing/recovery behavior.

No live OAuth reauthorization, real mobile Safari keyboard/OS suspension, or authenticated production Back-button session was exercised. Use a staging account for those checks.

## Production release — September 13, 2026

Deployed following the owner's explicit approval. Vercel status: READY, production, Next.js 16.3.5; remote build completed successfully in approximately one minute.

- Live: https://www.opryn.app
- Deployment: `dpl_AchYzuh2wyr6vjRqnHUbHh1cdVYx`
- Immutable URL: https://handoff-7k17n4ko1-nikitas-projects-acfaddb7.vercel.app
- Rollback target: `dpl_BfkpptHbcKiYcPfpenaANi4d1CpJ` — https://handoff-20lawcad4-nikitas-projects-acfaddb7.vercel.app
- Source: tested local working tree, not a newly created commit. No migrations or environment changes.
- Read-only live checks: homepage/login/signup returned 200; Needs You, Teach, Connections and Profile redirected unauthenticated requests to `/login` (307).
- New-deployment error-level log scan (last five minutes): no logs returned. This is an immediate release check, not a guarantee about future requests; drains/long-term monitoring were not audited.

### Checks run

- Production build: passed (102 static pages generated; existing dynamic routes retained).
- `npm run typecheck`, `npm run lint`, `git diff --check`: passed.
- `verify-motion-ui.mjs`: 90 real GSAP/React lifecycle assertions.
- `verify-product-ui.mjs`: 230 component browser assertions, including connected/disconnected Google teaching, Picker top-layer handoff, review and error states.
- `verify-settings-ui.mjs`: 100 component browser assertions with mocked accounts/APIs.
- `verify-knowledge-home.mjs`: 119 checks against the locally built homepage.
- `tests/marketing.spec.ts`: 12 desktop/mobile tests against the local production build.
- `verify-product-workflows.mjs`, `verify-process-approval.mjs`: passed existing conservative estimates, navigation, revision/authorization and failure-path checks with explicit API doubles.
- `verify-knowledge-library.mjs`: 20 SQL checks plus route contracts (local test database/API doubles).
- `graphify update .`: completed, AST-only graph refreshed.
