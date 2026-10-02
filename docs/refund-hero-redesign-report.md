# Clearer Opryn hero, AI and Pricing

> Historical design report. Core/Premium prices below are no longer current; public pricing is Starter $49/month and Pro $129/month. See [deployment pricing status](deployment.md#september-19-2026-price-cutover-status).

Status: implemented and verified locally. **Not deployed.**

## Audit

The previous right-hand scene used revision limits, an apricot review surface, weak review labels and a short question that did not clearly connect to its source. The left side repeated the product explanation in a second footnote. AI human review and the featured Pricing plan retained the older apricot color. Existing billing and external knowledge policy implementations were inspected before changes.

## Delivery

1. **Old hero problems:** inconsistent source/result emphasis, insufficient human-control labeling, orange review styling, redundant left copy.
2. **Removed:** revision-policy content, apricot/coral hero surfaces, redundant hero footnote, faint previews of future states. No dashboard screenshot, enclosing demo panel or numbered tabs.
3. **Architecture:** independent semantic source, official Opryn mark, human review, team/AI question and approved answer objects. Desktop remains asymmetric; no enclosing card.
4. **One example:** Refund policy — “Refunds over $500 need manager approval.” All proposal, question and answer states retain Customer Service Handbook as source.
5. **Approval:** shared OprynAction supports an optional success icon without altering existing product icons. A local decorative SVG check draws after the example's pending state, briefly turns green, and settles into slate on #EEF1F5. This is explicitly a marketing simulation, not a backend-confirmed workspace mutation. Edit opens contextual example help; it is not presented as a real editor.
6. **Rail:** 3px cobalt SVG paths draw through source → Opryn → human review → team/AI use → approved answer. AI branches from access control to its two consumers.
7. **Pointer depth:** Motion values and springs; group maximum ±8px/±5px with .4/.2/.6/.8/1 layer factors. Fine mouse pointers only. No tilt, cursor or trails.
8. **Motifs:** faint partial ring, 2.5% dot texture and 10% cobalt radial pointer light. No orange, apricot, stars or bot graphics in these HTML diagrams. Original supplied marketing posters below the hero remain unchanged.
9. **React Bits:** not installed. Existing Motion word entrance reused, not a fabricated React Bits API or new dependency.
10. **Mobile:** full-width, static readable source → Opryn → review/approved → question → approved answer. No pointer motion or miniaturized desktop layout.
11. **AI:** warm white, cobalt, navy and blue review surfaces; approved knowledge → Opryn → permission → team/connected AI. Human review uses the same refund example and approval check. Actual policy supports category selections, exact item selections and excluded categories; illustrative selections remain clearly labeled. No invented finance/HR permission system.
12. **Pricing:** new “Choose what fits your business today” headline, quiet Core white surface, Premium blue surface. Canonical Core $99/month / Premium $249/month, seats, entitlements and Stripe config unchanged. Annual toggle remains conditional on configured annual prices; trial terms remain server-derived. Checkout and resumable signup/onboarding URLs preserved.
13. **Shared theme:** public-only palette, neutral borders, gray completion, existing header/footer/action/heading systems reused. Authenticated UI unaffected except the backward-compatible optional action successIcon prop.
14. **Logo:** existing approved asset, hover scale 1.02, smooth scroll on homepage, home navigation from other public pages. Logo is not redrawn or rotated as a wordmark. Verified homepage click returns scrollY to 0.
15. **Accessibility:** one H1 per page, semantic articles/headings, labeled example, pause/play, meaningful button names, busy state, focus outline, hidden decorative check. Invisible loop panels are inert. Reduced-motion and compact layouts settle immediately; timers stop offscreen and in hidden tabs. Reduced-motion CSS disables the transient success text animation.
16. **Performance:** five discrete loop milestones rather than per-frame React state. Pointer motion stays in Motion values; timers/listeners clean up. No video, WebGL, canvas, GSAP or large animated raster hero.
17. **Screenshots:** artifacts/refund-hero contains desktop/mobile Home, AI, Pricing, and verified loop phases 0/source, 1/review, 2/pending, 3/approved, 5/answer. AI control is cropped from an actual browser screenshot, not supplied artwork. Recording capability was unavailable. Pointer behavior is implementation-verified; standalone synthetic pointer movement and OS media emulation were not available in browser tooling. Static/reduced behavior verified through SSR, mobile and pause; no claim of automated OS preference testing.
18. **Checks:** typecheck, lint, production build (120 routes), 53 public-flow checks, 35 editorial/asset checks and seven request-only Playwright tests passed. First Playwright invocation used the inactive default port; correct PLAYWRIGHT_BASE_URL rerun passed. Manual 390/768/1440 viewport inspections, no horizontal overflow, semantic H1 checks, loop milestone captures, keyboard comparison/FAQ and logo-to-top verified. No browser error logs in the captured final hero. No Stripe transaction, authenticated knowledge approval or deployment performed.

## Evidence

- [Desktop Home](../artifacts/refund-hero/home-desktop.png)
- [Mobile hero](../artifacts/refund-hero/home-mobile-hero.png)
- [Source](../artifacts/refund-hero/hero-source.png)
- [Review](../artifacts/refund-hero/hero-review.png)
- [Pending](../artifacts/refund-hero/hero-pending.png)
- [Approved](../artifacts/refund-hero/hero-approved.png)
- [Question / answer](../artifacts/refund-hero/hero-answer.png)
- [AI desktop](../artifacts/refund-hero/ai-desktop.png)
- [AI human control](../artifacts/refund-hero/ai-control.png)
- [AI mobile](../artifacts/refund-hero/ai-mobile.png)
- [Pricing desktop](../artifacts/refund-hero/pricing-desktop.png)
- [Pricing mobile](../artifacts/refund-hero/pricing-mobile.png)

Unknown-answer behavior stays in the later how-it-works / AI section instead of adding another hero loop. Current public billable values still depend on the repository's canonical config; no pricing policy was invented.
