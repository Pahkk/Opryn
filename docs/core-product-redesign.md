# Core product experience redesign

## Audit and plan

Inspected production `/app/ask`, `/app/processes`, `/app/needs-you` in the signed-in owner workspace, including Knowledge detail and mobile layout. Production inspection was read-only: no model requests, imports, approvals, archives, or permission changes. Inspected Next.js App Router routes, app shell/navigation, the three client workspaces, AnswerText/AnswerSources, native DialogSurface, knowledge scope and review controls, existing Motion list/tabs/receipt/tokens/reduced-motion utilities, thinking-orbs wrapper, and canonical server response/action contracts.

Problems: composer and empty-state instruction compete; Ask uses a generic spinner for actual AI work; generic repeated gap titles obscure the question; status is mostly inline text; Knowledge category sidebar is long, metadata editing competes with guidance, and all content has similar weight. Existing Motion infrastructure is usable; a second system is unnecessary.

Plan: (1) scoped bright tokens and shared status/working/decision feedback, (2) Ask answer console and contextual trust/actions, (3) scannable Knowledge rows and progressive detail, (4) decision-oriented Needs You, (5) isolated browser fixture QA, responsive/reduced-motion/keyboard/error checks and build. Preserve canonical request payloads, server permissions, approval/version guards, external integrations, billing, and icons. Do not deploy.

## Shared interaction vocabulary

- ProductStatus: icon plus semantic text, no numeric confidence.
- AnswerWorking: existing 64px OprynThinkingOrb only during real `/api/ask` work; no simulated stage timers. Motion fades its container, not its canvas.
- DecisionWhy: compact next-decision explanation, with source details disclosed in the existing review sheet.
- Existing MotionTabs/ActiveIndicator: locally namespaced sliding selection surface.
- Existing StaggerList: bounded entry/exit and position transitions, no entire-page layout animation.
- Existing DialogSurface: native top-layer focus trap, Escape and focus restoration; no cross-portal layoutId teleport.
- CSS only colors/borders/focus and existing small row affordances. GSAP guidance/story components remain untouched; no new GSAP timeline is needed for these everyday workflows.

## Delivered

### Ask Opryn

Rounded answer console with a stable desktop trust/source sidebar. Composer leads the first question and sits below the conversation afterward. Suggested prompts come from actual approved processes. Answers distinguish approved guidance from a knowledge gap, preserve source disclosure, and offer copy, follow-up, and authorized Testbench navigation. Unknowns preserve canonical expert routing; pending/error/retry feedback prevents silent failure. Feedback now asks for a reason before sending “not right.” Failed answers retain the question and attachment. A synchronous in-flight guard prevents duplicate requests.

Removed the old artificial typewriter (up to 4.2 seconds and per-character state updates): full semantic answer text is available immediately with a quiet Motion reveal. No confidence percentages, made-up sources, new authority, or fake extraction stages.

### Knowledge

White library surface, compact document/process identities, semantic status chips, category/version labels and quieter source metadata. Existing row accent/tint/action-reveal interaction is retained. Populated categories lead; a disclosure keeps every category available. Search, filters, server pagination, facets and URLs remain canonical. Empty views offer an appropriate browsing/teaching next action.

Detail uses a warm-white native drawer/full-screen phone sheet: guidance is a distinct cobalt-edged document, source/date/version metadata is grouped, applicability stays canonical, and classification editing is progressively disclosed. Existing Test, Impact, version-history/review, source, related-process, archive, and authorized draft-delete actions remain intact. No unverified dependency counts or new hard-delete policy.

### Needs You

Decision-center title, compact real queue totals, locally namespaced gliding filter pill, and one “Start with this” cue based on the existing priority/order (not an AI score). Question items lead with the actual question rather than identical generic titles. Summaries are bounded; full content remains in review. Real recorded recurrence counts are exposed from the already-loaded gap projection. Each item explains why human input is required. The existing server-confirmed receipt, list collapse, version guards, disabled controls, errors and canonical expert-answer/review loops are preserved. Empty filters do not incorrectly claim the whole queue is clear.

## Files changed in this pass

- `app/app/ask/page.tsx`: concise title copy and server-derived Testbench permission.
- `components/app/ask-opryn.tsx`: answer console/actions/working/routing feedback.
- `components/app/answer-text.tsx`: immediate full answer, quiet Motion reveal.
- `components/app/knowledge-library.tsx`: scanning, category disclosure, command drawer.
- `components/app/needs-you-center.tsx`: decision hierarchy/filter/source/recurrence feedback.
- `components/app/product-feedback.tsx` (new): shared status, AI-working, decision explanation.
- `components/app/product-workspace.css` (new): scoped bright product tokens/surfaces/mobile/focus.
- `components/motion/opryn-thinking-orb.tsx`: respect the existing product reduced-motion preference through package `paused` support (package also supports OS reduced motion and visibility cleanup).
- `lib/opryn/needs-you.ts`: expose existing recurrence metadata; no new query or decision logic.
- `scripts/verify-core-product-ui.mjs` (new): isolated rendered interaction tests and visual evidence.
- This document and AST-updated `graphify-out/` outputs.

## Motion, accessibility, performance

Reused installed Motion **13.3.0**, tokens, MotionButton, MotionRegion, MotionTabs/ActiveIndicator (`layoutId`), StaggerList (`AnimatePresence`/position layout), DecisionReceipt and DialogSurface. No additional animation dependency or GSAP sequence was added. GSAP homepage/guidance ownership remains unchanged. No shared element crosses the native dialog top layer.

Semantic buttons/links, icon-plus-text status, visible focus, native dialog trapping/Escape/restoration and reduced-motion behavior remain available. Full answer text has one accessible representation. The orb is decorative beside a polite status message; its container fades, not its canvas. Phone layouts use stacked metadata, compact horizontal filters, touch-size actions and full-screen sheets. The redundant desktop Ask sidebar hides on small screens; citations/actions remain inside answers.

No large page-tree layout animation, blur animation or new continuous UI motion. Existing list guard disables layout work above 40 rows. Actual answer content is no longer delayed by fake typing. Core Web Vitals and production device performance were not measured in this pass.

## Verification and visual evidence

Passed:

- `npm run build`: Next.js production build, including TypeScript and 120 static pages.
- `npm run typecheck` and `npm run lint`.
- `git diff --check`.
- `verify-core-product-ui.mjs`: actual React workspaces at **1440, 768, 390**; no horizontal document overflow or runtime errors. Tests sourced answer/orb completion, copy/follow-up, feedback reasons, unknown-routing failure/retry, failed-answer/input recovery, filter/drawer/Escape/focus restoration, rapid queue filters, approval 409/success/receipt/removal, mobile answers/sheets, empty states and reduced motion.
- `verify-knowledge-library.mjs`: 20 isolated PostgreSQL/library checks plus route contracts for organization isolation, auth/admin guards, stale metadata/approval and atomic archive.
- `verify-phase-two-service.mjs`: canonical trust/test/scope services, actual role restrictions, conflict/clarification, citations and access/version race checks.
- `verify-phase-three-service.mjs`: source-import/freshness/access regressions with explicit provider/model/database doubles.
- `graphify update .`: AST graph updated, no LLM/API use.

Reviewed rendered screenshot output including desktop Ask answer/working state, desktop Knowledge/detail, phone Knowledge/Ask answer/Needs You/review sheet. Evidence is under `artifacts/core-product-redesign/`: `ask-answer-desktop.png`, `ask-answer-mobile.png`, `ask-working.png`, `ask-gap.png`, `knowledge-1440.png`, `knowledge-390.png`, `knowledge-detail-desktop.png`, `knowledge-detail-mobile.png`, `needs-1440.png`, `needs-390.png`, `needs-detail-mobile.png`, `needs-resolution.png`, tablet and reduced-motion/empty variants. Automated interaction recordings are in `motion/` (latest `page@e57aa93838ff81bb2061e93950c502c7.webm`); these are test interaction recordings, not a manually paced full authenticated walkthrough.

## Limitations / remaining rough edges

New output was tested with actual components and isolated HTTP responses, **not** a newly deployed authenticated staging workspace. Production was inspected read-only; no production model/provider requests, data mutations, migrations or deployment occurred. Existing backend permission/trust behavior was regression-tested with explicit doubles and an isolated PostgreSQL engine, not live-provider E2E.

Ask currently receives grounded answer/unknown/error responses from the existing API; it does not invent separate restricted/conflict UI results or source version fields the endpoint does not return. Versions/scopes are visible in canonical Knowledge detail/Testbench. Existing conversation persistence and source/provider capabilities are unchanged. Human-answer editor internals retain existing workflows; longer questions/knowledge remain scrollable and may still require substantial reading in detail. No billing, integration, logo/icon, homepage, or approval-authority changes. **Not deployed.**

Interaction principles checked against official [Motion layout guidance](https://motion.dev/docs/react-layout-animations), [Motion accessibility guidance](https://motion.dev/docs/react-accessibility), and [Linear’s focused product surfaces](https://linear.app/features); no proprietary layout/artwork was copied. The React/Next.js skills influenced reuse of existing boundaries/primitives, bounded layout work and accessible immediate content rather than an additional UI framework.
