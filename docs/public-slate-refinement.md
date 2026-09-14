# Public slate identity and workflow positioning

## Scope

**Deployed and verified.** No database migrations, pricing changes, authentication changes, or integration changes.

Production: https://www.opryn.app

- Deployment: `dpl_BnahmPbEC4rffb3LF2NVZuMfsRLa` (READY).
- Immutable URL: https://handoff-hp2ha3x48-nikitas-projects-acfaddb7.vercel.app
- Rollback baseline: `dpl_DXXm43aPpuqgCkJTJQV1cQbWCner`.
- Release scope verified against Vercel source hashes; see `docs/release-safety.md`.
- Fresh build, typecheck, lint, and 28 desktop/mobile tests passed.
- Live homepage, login and pricing returned 200; protected Needs You redirected to login.
- Live Chromium 1440px/390px slate palette and scroll-story checks passed, without page errors or horizontal overflow. Screenshots: `artifacts/public-slate/live/`.
- Initial five-minute scoped error-log query returned no logs; not a long-term monitoring guarantee.
- Read-only QA script and release-note updates after upload remain local and do not alter runtime behavior.

The homepage, shared public navigation/footer, pricing, Security, About, AI, Contact, Privacy and Terms inherit the new palette. The authenticated app and its functional onboarding/account screens retain their established application theme; a separate migration should be assessed independently.

## Positioning

- Removed named-company comparison copy, competitor links, the comparison matrix, and unused contrast markup/styles.
- Replaced them with **Why Opryn — Your information already exists**, three editorial workflow rows, and a neutral **From information to operation** treatment.
- Consolidated repeated post-story principles into the new editorial section.
- The story emphasizes discovery → structured proposal → human authority → approved answer → authorized use → unanswered question → expert → review → reuse.
- Feedback is explicitly illustrative: an expert answer becomes reusable **after human approval**, not simply because it was supplied.
- Existing CTAs and functional destinations remain intact.

## Visual system

The new app/public-tokens.css owns public brand and semantic colors. Existing public styles consume these tokens.

- Slate actions/paths: #536B82; deeper text/active states: #34495E.
- Gray-blue surfaces: #F4F5F6, #FAFAF9, #E9EDF1, #DDE4EB.
- Approved/success: muted green; Needs Review: amber; unknown/metadata: gray.
- Secondary text uses #5B6672, slightly darker than the proposed #65707B, for contrast on tinted surfaces.
- Official Opryn and Google artwork remains unchanged. Existing neutral human photography is retained; no new raster art was generated.

Tested contrast pairs: primary text/page 15.70:1; secondary text/tint 4.56:1; button text/slate 5.30:1; deep slate/tint 7.24:1; Approved 5.55:1; Needs Review 5.27:1. These checks are not a blanket accessibility certification.

## Motion

Preserved existing GSAP/useGSAP architecture and lazily loaded ScrollTrigger, Flip and SplitText. No packages or plugins added.

- One reversible master timeline; labels remain intro, sources, search, converge, proposal, review, approved, distribution, feedback, difference, final.
- Desktop distance remains 2800–3800px (3420px at 900px viewport height), scrub 0.9.
- Masked headlines, source convergence, persistent knowledge object, approval morph, measured SVG paths, and feedback return remain.
- Background progression: Information #F4F5F6 → Structure #EEF1F4 → Review #E9EDF1 → Approved #E4E9EE → Use #DDE4EB.
- Six-stage progress uses real scroll position and timeline labels.
- Mobile/tablet retain normal scrolling. Reduced motion, static mode, no-JavaScript content and failed-motion-module fallbacks remain.
- Existing resize recapture, scoped cleanup and route-change disposal are preserved.

## Files

- Added app/public-tokens.css.
- Public styles: app/globals.css (one import), app/editorial-home.css, app/gray-green-home.css (legacy filename, now token-driven), app/launch-public.css.
- Story: components/marketing/knowledge-centerpiece.tsx, its CSS, desktop motion and mobile motion modules.
- Pricing: components/pricing-page.tsx; presentation only.
- Existing update connector: components/motion/motion.css; scoped public stroke token.
- QA: scripts/verify-public-slate.mjs; existing homepage, story and motion-stress scripts now save separate slate artifacts.
- Repository graph refreshed with graphify update.

## Verification

- Production build, TypeScript and lint passed.
- Existing public-route suite: 28 tests passed, including navigation/auth entry points and unauthorized API rejection.
- Homepage suite: 119 checks passed, including 320/360/390/430/768/1440 widths, demo controls, no-JavaScript and reduced motion.
- Revised continuous story: 486 checks passed in Chromium and WebKit at 1440/1280/1024/768/430/390.
- Motion stress: wheel input, trackpad-like deltas, reverse scrolling, same-breakpoint resizing, Back, mobile sticky progress and reduced motion passed in both engines.
- Public palette/route audit passed in Chromium and WebKit at 1440/1280/768/430/390: no horizontal overflow, correct public backgrounds, preserved official provider colors, no named competitors in positioning, and successful public route responses. Sixty public-surface screenshots were captured.

Screenshots are local rendered UI, not concept images:

- artifacts/public-slate/surfaces: hero, Why Opryn, final CTA, footer, pricing and Security.
- artifacts/public-slate/story: information, convergence, review, approved, distribution, knowledge gap, learning and final positioning; desktop and mobile.
- artifacts/public-slate/home: full static homepage and additional responsive checks.

## Limitations

WebKit is engine coverage, not a physical Safari/iPhone test. No production Core Web Vitals claim is made. Demonstration answers and approvals are illustrative; live Google, billing or external-agent behavior was not retested by this presentation pass.

The initial WebKit multi-route harness reported canceled legal-page prefetch requests during forced navigation. Each route was then checked in an independent page, with page errors still asserted; all passed. Story Back/navigation stress passed separately.

Existing unsigned Slack/Teams rejection tests pass, but local post-response audit logging reports missing server billing-storage configuration. This pre-existing local environment limitation is unrelated to the public-site changes; no secrets or configuration were modified.
