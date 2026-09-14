# Homepage knowledge centerpiece

## Implementation

- `components/marketing/knowledge-centerpiece.tsx`: accessible HTML story, example labeling, static toggle, skip link, lazy initialization.
- `knowledge-centerpiece-motion.ts`: scoped desktop GSAP timeline and ScrollTrigger cleanup.
- `knowledge-centerpiece-mobile.ts`: lightweight unpinned entrance animation; no ScrollTrigger dependency.
- `knowledge-centerpiece.css`: responsive composition and static fallbacks.
- `story-home.tsx`: replaces the previous how-it-works diagram, leaving other homepage sections intact.
- `scripts/verify-knowledge-centerpiece.mjs`: browser regression coverage. Existing homepage/signature tests updated for the replacement.

No dependencies, database fields, migrations, credentials, pricing, or backend behavior changed. The approval is explicitly an illustrative workflow, not a live action.

## Timeline

Desktop requires at least 1024px width and 760px height. Trigger: `.kc-track`; start: `top 88px`; end: 1.8 viewport heights; scrub: 0.25; pin: `.kc-stage`; pinSpacing: false. Reserved track space prevents late initialization from expanding the page.

The normalized timeline progresses through source (0–0.3), organization (0.3–0.45), human review (0.45–0.6), approval (0.6–0.7), authorized destinations (0.7–0.91), and the People + AI conclusion (0.91–1). SVG paths use measured length and strokeDashoffset, with no particles or glow. React owns controls; GSAP only changes presentation.

Mobile and short desktop screens use a normal vertical sequence with one-time entrance animation. Reduced motion, the Read without animation control, and disabled JavaScript expose the complete static story without pinning. Failed lazy downloads also restore compact static layout. Media-query changes and unmount revert contexts and pinning; stale imports are ignored.

## Verification

- 123 centerpiece browser checks at 360, 390, 430, 768, 1024, and 1440px.
- 119 existing homepage checks.
- 12 public marketing Playwright tests.
- Typecheck, lint, production build, and diff whitespace checks.
- Tested scroll stages, reverse scroll, rapid mode changes, responsive resizing, reduced motion, no JavaScript, blocked animation download, and horizontal overflow.
- Tests use the real rendered public UI with explicitly illustrative content, not live Google authorization or company approvals.

Screenshots: `artifacts/knowledge-centerpiece/`, including `distribution-1440.png`, `final-1440.png`, and `kc-review-390.png`.

## Performance and limitations

ScrollTrigger loads only near the section on eligible desktop screens. Mobile loads a separate small module. Before the mobile split, measured timeline plus ScrollTrigger overhead was approximately 18.7KB gzip, excluding the existing shared GSAP core. No field Core Web Vitals claim is made.

QA corrected static-fallback whitespace, final-label overlap, connector endpoint gaps, round-cap ghost dots, and unnecessary mobile ScrollTrigger loading. Essential HTML remains readable if animation cannot initialize.

## Release safety

Previous production rollback target: `handoff-hk60vy02o-nikitas-projects-acfaddb7.vercel.app` (`dpl_6R4Km8WnuGEuKdfnjMuDnKMXWFV3`). This release requires no migration or external setup.

Released to production at `https://www.opryn.app`: `dpl_6dBB9s7vXSEpee7YPGSwfTmJW1Pd`, immutable URL `https://handoff-pm41lxooa-nikitas-projects-acfaddb7.vercel.app`. Vercel reports READY; remote build completed in 51 seconds. Deployed from the existing working tree, not a new commit.
