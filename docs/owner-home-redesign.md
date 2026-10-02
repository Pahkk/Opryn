# Authenticated Home redesign

## Audit

Inspected the actual signed-in production Home, its accessibility tree and desktop screenshot, server route, DashboardPulse, DashboardDecision, OwnerAnswer, owner intelligence, Knowledge Health preview, app shell/Guide targets, loading state, greeting, SVG icons, shared action/check/trace/number components, tokens, and reduced-motion support. The live first screen was dominated by Workspace Pulse and a repeated next-action block; four quick-action cards preceded the actual decision queue. Long questions and duplicated handled/activity/owner sections weakened priority.

Live mobile and a populated new authenticated local route were not session-tested. New rendered UI was visually inspected through actual React component browser fixtures at 390, 768 and 1440px, including standard and reduced motion. Those screenshots use explicitly isolated example data, not private workspace records. No production approvals or database mutations were performed.

## Layout and removals

The admin Home now uses `OwnerHome`: greeting → compact real summary → compact action rail → Needs You → Teach Next → Recently Handled → Knowledge Health. Desktop uses an open main decision column and a supporting sky-blue recommendation; mobile follows action-first single-column ordering. No giant KPI or four-card quick-action grid.

DashboardPulse, DashboardDecision and the separate learning-progress block are removed from the **Home composition**, not deleted from the repository. Owner intelligence, time estimates, channel statistics, recent changes and company analysis remain available beneath one expandable supporting section. Employee Home, billing boundary, organization scoping and permissions remain unchanged. Ask/Teach/Review/Invite stay accessible. The Guide retains its small secondary launcher and its existing Home target.

## Created and changed components

- `components/app/owner-home.tsx`: interactive owner working surface, scoped LayoutGroup, expandable decision rows, guarded approval, receipt/settlement, recent approved continuity, first-knowledge milestone.
- `components/app/owner-home.css`: open editorial hierarchy, semantic 3px status rails, restrained warm/sky environment, responsive controls, focus and reduced-motion rules.
- `components/app/local-greeting.tsx`: optional once-per-view word rise/overshoot/settle; local-time greeting retained; one accessible H1.
- `components/app/knowledge-health-preview.tsx`: optional compact real-count presentation with approved entries, approval decisions, open conflicts and potentially outdated findings. Other callers keep the previous presentation.
- `components/app/owner-answer.tsx`: optional deferred refresh for Home, allowing the confirmed answer receipt to land before removal; existing callers retain automatic refresh.
- `components/opryn-icons/opryn-icons.tsx`: additional vector Policy, Decision, Exception, Approver, AI Connection, Test Answer, Impact and Archive exports, using the existing shared rounded monochrome frame. Existing navigation/provider/logo marks are preserved; not every new export needs to appear on Home.
- `app/app/page.tsx`: server data retained; dedicated organization-scoped recently answered query prevents unresolved questions from crowding handled evidence out of the feed. Obsolete resume-intent fetch removed; saved setup still has a resume link.

## Approval state machine

Idle → pressed → pending → server-confirmed Approved → 550ms settled receipt → row exit → remaining list repositions → approved title appears in Recent Knowledge.

Only existing proposals whose primary action is `accept` get inline approval. Requests use the existing `/api/knowledge-proposals/:id/approve` route, including proposal version, updated timestamp and knowledge version. Non-OK, malformed success responses and version conflicts are not shown as Approved. The existing hook's synchronous lock prevents double submission; errors keep the decision and allow retry. Items requiring full process/conflict/scope review continue through their existing review URLs, not an unsafe dashboard shortcut.

Human answers use the existing OwnerAnswer service and expert/approver separation. A confirmed receipt is shown before deferred refresh. No optimistic approval, fake sources, invented company guidance or new API/migration is introduced.

First-knowledge feedback uses a small check, text and six decorative cobalt/sky/apricot particles only when the server-provided workspace baseline has no approved knowledge. Routine approvals settle quietly without confetti.

## Motion and interaction

Motion 13.3.0 was already installed. Reused shared OprynAction, SuccessCheck, MotionNumber, OprynTrace and timing tokens. Numbers start at real values rather than zero. Header/summary/section entrance is bounded to roughly 620ms; content stays server-visible and immediately actionable. Layout projection is only on changing rows, not the full page. Inline expansion retains the same title/source DOM, so it needs no risky cross-portal layoutId.

Row hover/focus grows its status rail, tints the surface, shifts the title 2px, increases metadata clarity and moves the arrow 3px. These lightweight local hover properties use CSS transitions; structural changes, checks, receipts and entrances use Motion. Teach Next has a single optional trace, 3px document-motif motion and restrained CTA feedback. Not every object scales or gets a trace.

The recent user preference against spinning/rolling text is preserved: no duplicate rolling labels were reintroduced. React Bits is not installed/vendored, so no premium, invented or extra-framework imports were added. The greeting is an original Motion keyframe treatment; no rotating line or repeated paragraph animation. GSAP is not needed on Home.

## Real work, health and evidence

The existing external-learning job supplies the compact work strip. Thinking Orb appears only for processing/extracting/organizing, not queued `received`, ordinary fetching or page loading. The arbitrary two-thirds progress decoration is removed. Findings still require human review. Refresh uses the real router transition plus the existing 90-second visible-page refresh cadence.

Handled evidence is actual answered-by-Opryn questions, with originating channel and date. Compact summaries disclose the full retained question and a follow-up action. It does not fabricate the historical answer/source; that retrieval detail was not in the current feed payload. Health uses counts with explicit units, not a fabricated percent/score or misleading distribution combining unlike record types.

## Accessibility and performance

One semantic H1; hidden visual duplicates have one stable accessible heading. Buttons expose aria-expanded/controls, pending/confirmed labels and meaningful alert text. All hover patterns have focus equivalents; actions remain visible on touch. Exiting rows are inert/aria-hidden. Focus moves to Refresh only if the resolved row held focus; typing in another decision is not interrupted.

Reduced motion removes word overshoot/travel, trace drawing, particles and hover movement; checks remain static and statuses readable. No animated heavy blur, WebGL, continuous ambience, whole-page layout or large shadow interpolation. Home displays at most five decision rows and five handled rows, with View all preserving the complete inbox. No virtualization changes or new dependencies. Official logo and functional SVG loading distinction remain unchanged.

## QA and limits

`scripts/verify-owner-home.mjs` runs real components against isolated HTTP doubles across 390/768/1440px with standard/reduced motion. 120 assertions passed: summary, one H1, overflow, keyboard expansion, pending, failure/retry, version payload, duplicate click, confirmed check, removal, approved continuity, first milestone, full-review routing, empty states and runtime errors. Screenshots cover Home, hover, expansion, pending, success, settled and empty states. Desktop approval videos are in `artifacts/owner-home/recordings/`.

Typecheck, lint and production build passed. Existing setup-checklist states and external-learning lifecycle checks passed. The AST knowledge graph was refreshed. The full authenticated production mutation loop, mobile live session, historical answer drilldown and all external work types were not E2E-tested. Source work strip currently reflects the existing external-learning job feed, not an invented universal background-job monitor. No paid-access dependency, migrations, plan changes or deployment performed.

Remaining refinement: full process decisions intentionally use the existing review page; historical answered text/source can be expanded in future only with the actual retained response payload. Newly added icon exports are available for gradual adoption rather than forcing icons onto every row.
