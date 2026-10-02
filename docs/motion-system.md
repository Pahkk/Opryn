# Opryn motion system

## September 16 homepage amendment

Inside Opryn is now a Motion-owned, user-controlled tabbed product window, not a second GSAP pinned sequence. PublicAction owns marketing CTA interaction; PublicReveal owns ordinary section entries. The six-stage knowledge story remains GSAP-only, explicitly registered through `lib/motion/story-gsap.ts`, and now adapts down to 620px desktop viewport height. See [homepage-motion-refresh.md](homepage-motion-refresh.md) for the live audit, ownership convention, tests and evidence. This supersedes the product-proof ownership statements below.

## Current architecture — Motion 13.3.0 / GSAP 3.15.0

September 15, 2026. This section supersedes the historical GSAP-only implementation below.

### Ownership

| Owner                   | Responsibility                                        | Examples                                                                                                            |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Motion (`motion/react`) | React product state, local layout, presence, controls | routes, native-dialog content, selected files, filters, lists, approval receipts, onboarding, counters              |
| GSAP                    | Choreographed timelines and SVG/text storytelling     | pinned homepage, scroll-driven Inside Opryn, TeachPipeline, WelcomeStory, FlowLine, masked headlines, Guide pointer |
| thinking-orbs           | AI working visualization                              | orb internals; Motion only transitions its outer status area                                                        |
| CSS                     | Static styling, focus, simple color/hover states      | borders, foreground/background, focus rings                                                                         |

Mark animated roots with `data-motion-owner="motion"` or `"gsap"`. Never animate the same property of the same DOM node from both systems. Nested owners are allowed only for distinct nodes: e.g. GSAP owns the product-proof screenshots and timeline, Motion owns its tab underline. No global GSAP defaults or general-purpose GSAP product wrappers remain.

### Reused primitives

- `lib/motion/motion-tokens.ts`: 140/200/260/420ms durations, shared ease, 420/34/0.7 control spring, 280/30 layout spring. Existing `presets.ts` now serves GSAP storytelling only.
- `use-product-motion.ts`: Motion OS preference plus the existing saved `data-motion="reduced"` preference and document visibility. A single shared observer is removed when the final consumer unmounts. SSR starts visible.
- `MotionRegion`: Motion `useAnimate`, existing page/step/status/quiet API. Keeps children mounted; interrupts on errors. Does not retain obsolete private routes, gate navigation, or reset forms merely to animate them.
- `StaggerList`: real keyed `AnimatePresence`/`layout="position"` using original button/article/div tags. Removed rows become inert and hidden from assistive technology. Entry delay is capped at 120ms; lists over 40 rows skip entry/layout work. Knowledge already paginates to 30 rows (6 on overview). No virtualization introduced.
- `SelectionTrack`: measured Motion selected underline, including nested/scrolling/wrapping controls. `MotionTabs`/`ActiveIndicator` use local `LayoutGroup` namespaces and `layoutId` for nearby selection states.
- `MotionPanel`: conditional height/opacity expansion with noninteractive exits. `TeachWorkflowScope` portals full-width provider workflows into their source row while retaining provider branding and controls.
- `DialogSurface`: canonical native dialog/focus trap remains. Motion animates only `.dialog-content` or `.needs-you-sheet`, with a 24px entry inside the viewport (vertical on mobile). Dismissal and Google Picker handoff remain immediate. This is the shared drawer/sheet/modal surface; no parallel dialog primitive was added.
- `PresenceSwap`: short state text/working indicator transitions; never editable forms or answer streams.
- `MotionNumber`/`MotionProgress`: `useSpring` and `useTransform`, starting from the actual server value. Accessible values update immediately, visual values settle. No fictitious count-up from zero.
- `MotionButton`/`MotionHover`: max 1.01 hover / .99 press, or 1px lift. No mouse-following marketing cards remain.
- `SetupContext`: persistent company/knowledge context reflows with Motion; approval status uses the same source of truth.

### Surface migration

| Surface                                                                                          | Implementation                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell / Home / Ask / Teach / Knowledge / Needs You / Team / Connections / Settings / Profile | existing AppShell content wrapper now uses Motion; navigation stays stationary; sensitive settings retain immediate presentation                                                                                  |
| Home                                                                                             | confirmed-count springs and real handled-rate progress; recent activity keyed updates; owner-answer approval transitions into a confirmed receipt linked to Recent Knowledge; receipt survives the server refresh |
| Needs You                                                                                        | review-to-receipt height transition, keyed queue reflow and exits; existing explicit Clear completed control retained for pointer safety                                                                          |
| Knowledge                                                                                        | result rows, removal/reordering, selected nav indicator, native detail/filter/category drawers; no cross-portal layoutId flight                                                                                   |
| Teach                                                                                            | connected-source filtering, Google selected-file expansion, Notion/Confluence inline selectors, selected-content lists; existing inline OAuth resume retained                                                     |
| Team                                                                                             | existing member/invite StaggerList callers now use Motion; canonical dialog retains permissions and focus                                                                                                         |
| Connections                                                                                      | categorized result lists, active filters, success surface, selected files and canonical sheets                                                                                                                    |
| Onboarding                                                                                       | 260ms step changes without form remounts, goal microinteraction, persistent setup context, stage progress and local active indicator, billing frequency/amount/confirmed-state changes                            |
| Ask Opryn product help                                                                           | message entry, panel/sheet, orb-to-submit transition; GSAP pointer/Driver target lifecycle unchanged                                                                                                              |
| Public                                                                                           | mobile nav content, controls, integration filters/results, product-proof active tab, pricing frequency/amounts, FAQ expansions and restrained card hover                                                          |
| Profile                                                                                          | avatar changes use quiet Motion entry, existing save feedback uses the shared status wrapper                                                                                                                      |

### Deliberate boundaries

- App Router content enters immediately. No frozen-router workaround or retained authenticated page exit.
- Knowledge drawers use title continuity through an anchored native surface, not `layoutId` across a top-layer portal. No teleporting proxy elements.
- Home approval produces a confirmed receipt and refreshed activity. It does not animate a fabricated database object between unrelated routes.
- Inside Opryn remains a GSAP scroll sequence as previously requested; only the indicator is Motion-owned.
- `useScroll` is not added: existing scroll progress belongs to GSAP; new product progress is derived from real data via `useSpring`.
- Reduced motion disables displacement, layout springs, stagger and hover. GSAP retains its existing static fallbacks. Functionality, focus and status text do not depend on animation.
- Native dialog dismissal is immediate to preserve Escape, focus restoration and third-party Picker top-layer handoff. Normal conditional panel/list exits use AnimatePresence.

### Verification / assets

`verify-motion-ui.mjs` exercises rapid updates, unsaved fields, errors, account/OS preferences, unmount, hidden-page recovery, native focus and 4× CPU slowdown. `verify-motion-product.mjs` uses actual Teach, provider selection, Needs You, Knowledge and Home components with explicit API doubles at 1440/1280/1024/768/430/390px. Tests do not connect customer providers, approve production records or charge cards.

Screenshots and WebM recordings: `artifacts/motion-product/`, `artifacts/motion/recordings/`. Existing activation, Guide, Settings, product UI, public-layout, product-proof and GSAP stress suites cover the adjacent workflows. The reports distinguish fixture OAuth/Stripe behavior from real provider authorization. Real device keyboards and live OAuth round trips have not been reauthorized for this visual migration.

References: [Motion accessibility](https://motion.dev/docs/react-accessibility), [presence](https://motion.dev/docs/react-animate-presence), [bundle guidance](https://motion.dev/docs/react-reduce-bundle-size).

## Historical implementation (superseded)

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
