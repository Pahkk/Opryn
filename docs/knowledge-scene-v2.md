# Continuous knowledge scene — local review

Deployed with owner approval to https://www.opryn.app/#how-it-works.

## Deployment result

- Target: production; status: READY.
- Deployment: `dpl_JDkwYt8afw8vYSuurF17sQqzLHfq`.
- Immutable URL: https://handoff-7cjedrhde-nikitas-projects-acfaddb7.vercel.app.
- Framework: Next.js 16.3.5; remote build: 56 seconds.
- Source: verified working tree, not a new commit.
- Rollback: `dpl_6dBB9s7vXSEpee7YPGSwfTmJW1Pd` / `handoff-pm41lxooa-nikitas-projects-acfaddb7.vercel.app`.
- No migration or environment changes.
- Persistent monitoring/drain configuration was not audited in this release.

## Scope and architecture

Only the existing homepage centerpiece and its adjacent differentiation section changed. No pricing, authenticated app, backend, schema, OAuth, or integration changes. No new packages.

Files:
- `components/marketing/knowledge-centerpiece.tsx`: one persistent source set and knowledge article; comparison and three editorial principles.
- `knowledge-centerpiece-motion.ts`: one desktop master timeline, scoped GSAP context, lazy ScrollTrigger.
- `knowledge-centerpiece-mobile.ts`: unpinned source settling and same-card review-to-approved transition.
- `knowledge-centerpiece.css`: masks, source-specific representations, responsive diagram and comparison layout.
- `scripts/verify-knowledge-scene.mjs`: Chromium and WebKit checks and screenshots.
- `scripts/verify-knowledge-centerpiece.mjs`: existing test entry point delegates to the new suite.
- `scripts/verify-knowledge-home.mjs`: updated assertions for the single persistent rule object.
- `scripts/record-knowledge-scene.mjs`: clean continuous-scroll recording.

## Choreography

Desktop uses a 650px stage pinned below the stable navigation at 88px. Scroll distance is **220vh**, scrub smoothing **0.65**, `anticipatePin: 1`, `invalidateOnRefresh: true`, and reserved track space with `pinSpacing: false`. Enabled only at width >=1024px and height >=760px. Other sizes use the vertical sequence.

Master timeline labels, on a 0–100 scale:

| Label | Position | Continuous transformation |
|---|---:|---|
| sources | 0 | Four distinct source fragments enter from four directions |
| oldWay | 12 | Search discovers a source, without changing its authority |
| converge | 25 | Fragments physically move to the center, clip into a source stack, and open into the structured rule |
| review | 42 | Same rule comes forward; human review controls and example focus treatment appear |
| approve | 54 | Same status container narrows and rolls from Needs Review to Approved; provenance remains |
| distribute | 64 | Paths grow from measured rule edges to five small outputs; the rule stays unchanged |
| compare | 82 | Same rule moves right; the original sources regroup left in a workflow comparison |
| final | 93 | Same rule returns to the middle, between supported inputs and authorized consumers |

Headlines roll through overflow masks rather than cross-fading. Sources retain their DOM identity and titles through convergence and the comparison. Coordinated transforms are used instead of Flip because no reparenting or changing layout is needed; this also makes backward scrubbing deterministic. SVG geometry is measured on refresh, not on every frame.

## Mobile and accessibility

Mobile has no pin or scrub. Sources settle, then the same rule's review status rolls to Approved and the illustrative action area collapses. Outputs reveal as ordinary scroll content. Reduced motion and Read without animation show the static sequence. No-JavaScript and failed-download fallbacks remain readable. Headline animations are aria-hidden; a stable semantic heading and HTML narrative remain available. Simulated approval controls are spans, not deceptive buttons. No provider or business requests occur.

## Capability and positioning audit

`lib/integrations/catalog.ts` supports selected Google Workspace files, selected authorized call learning, and owner-provided information. Guided Notion/Confluence integrations are not presented as ready inputs in the animation.

`app/api/v1/answer/route.ts` enforces external knowledge-read authorization, requires cited approved knowledge, records unknown questions, and reports whether escalation is authorized. The external escalation answer route can save reusable knowledge. These support the gap and external-context positioning; this pass did not test live external accounts.

The pricing sheet contains prices, not refund authority, so only Refund Policy and Owner answer are cited as authority for the rule. The example version is explicitly labeled as an example. Team answers preserve the manager-role qualification. No automatic refunds, model training, historical conversation rewriting, or cache invalidation are claimed.

Comparison is explicitly about primary workflow, not exclusive features. Its wording acknowledges connected sources, AI, and governance. Primary references checked:
- [Notion Enterprise Search](https://www.notion.com/help/enterprise-search)
- [Atlassian Rovo capabilities](https://www.atlassian.com/software/rovo/features)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)

## Verification and review artifacts

- 270 counted continuous-scene browser checks in Chromium and WebKit, with additional geometry/status assertions.
- Widths: 1440, 1280, 768, 430, 390. Existing homepage regression adds 320 and 360.
- 119 existing homepage checks and 12 marketing Playwright tests passed.
- Typecheck, lint, production build and diff whitespace checks passed.
- Tested reverse scroll, rapid direction changes, resize across the desktop breakpoint, static toggles, reduced motion, disabled JavaScript, failed lazy download, navigation cleanup, persistent card identity, headline masking, path origins, and final-caption clearance.
- WebKit testing is not a claim of testing the installed Safari application or a physical iPhone.

Screenshots are in `artifacts/knowledge-scene/`: `chromium-sources.png`, `chromium-converge.png`, `chromium-structured.png`, `chromium-approved.png`, `chromium-distribution.png`, `chromium-compare.png`, `chromium-final.png`, and matching WebKit captures. Mobile: `chromium-review-390.png` and `webkit-review-390.png`.

Recording: `artifacts/knowledge-scene/signature-walkthrough.webm`.

## Issues caught and fixed

Initial visual QA caught headline layers peeking through masks, final and comparison captions colliding with the compact object, and a rectangular background patch. Fixed with full-height headline masks, adjusted final/comparison transforms, and section-wide background interpolation. Automated tests now check mask isolation and caption clearance.

The animation remains lazy-loaded and cleans up with `ctx.revert()`. Mobile does not import ScrollTrigger. No field Core Web Vitals measurements or live integration tests are claimed.
