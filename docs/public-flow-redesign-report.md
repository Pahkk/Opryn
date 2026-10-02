# Public hero, AI and Pricing redesign

> Historical design report. Its Core/Premium prices describe the site at the time; current public pricing is Starter $49/month and Pro $129/month. See [deployment pricing status](deployment.md#september-19-2026-price-cutover-status).

## Scope

Redesigned the homepage hero’s right side and the public AI/Pricing pages. Kept the homepage’s supporting copy, CTA destinations, original three supplied marketing graphics and below-hero content. No authenticated-product, entitlement, Stripe configuration, provider integration, database or artwork changes. **Not deployed.**

## Homepage hero

1. **Original issues:** a large enclosed demo, Teach/Review/Use tabs, nested panels and explanatory copy competed with the headline. The visual felt like a screenshot rather than Opryn’s identity.
2. **Removed:** the `KnowledgeDemo` instance from the hero. Its component remains available for other consumers; no unrelated demonstrations were deleted.
3. **New structure:** a loose source card, official Opryn mark, apricot human-review object, sky team-question object and approved answer. Four thin cobalt SVG rails connect the scene. The left side retains the headline, supporting copy and two CTAs.
4. **Approval:** reuses `OprynAction` and the existing `SuccessCheck`, progressing Approve → Approving… → Approved. The settled button is cool gray. A manual example approval locks repeated presses while pending. This is explicitly labeled an example; it performs no workspace write and makes no backend-success claim. The existing supplied approved icon is retained rather than replaced with a newly drawn SVG check.
5. **Motion:** discrete milestones across an eight-second cycle, with a 650ms introductory delay. Source, review, approval, team question and answer enter progressively; the reset fades gently. A pause/play control settles the composition. Timers are cleaned up when stopped/unmounted. Offscreen and hidden-tab states stop work and settle.
6. **Pointer depth:** Motion values and springs, ±10px/±6px bounds, layer factors .35/.2/.6/.8/1. No per-pointer React state, perspective, tilt or custom cursor. Fine mouse pointers only; leaving resets the light and offset.
7. **Background:** an oversized partial ring and faint dot field, plus a soft pointer-follow radial highlight. No new AI stars, generated graphics or animated backgrounds.
8. **React Bits:** no installed package or verified local component API was found. Reused the existing Motion-based `EditorialHeading` word entrance instead of adding or inventing an API. Body copy stays static.
9. **Responsive:** desktop uses the 44/56 split; the 768px tablet view gives the scene a full-width 640px area. At ≤760px the scene becomes a legible, settled vertical Source → Review → Approved guidance → Team use flow, with a small official mark. It is not a shrunken desktop composition.
10. **Reduced motion:** OS/account preferences and hidden-tab behavior use the existing product-motion hook. Reduced motion displays all cards in the settled state, with no loop, pointer motion or spring entrance. Small-screen scenes use that same settled presentation.
11. **Performance:** transform/opacity/Motion values and four SVG rails; no canvas, WebGL, GSAP, animated blur, large shadow loops or per-frame React updates. The official 180px mark is reused at an appropriate display size. No new runtime dependency.
12. **Screenshots:** `artifacts/public-flow-redesign/home-desktop-hero.png`, `home-cobalt-section.png`, `home-mobile-hero.png`, and full-page/tablet captures. An eight-second video was not recorded: the connected browser exposes screenshots/viewport controls, not recording.
13. **Checks:** see verification below. Live pause/play, manual pending/success, settled mobile layout and logo back-to-top were checked. The homepage still renders exactly three original supplied marketing posters, without duplication or asset modification.

## AI page

1. **Original issues:** the prior `PublicInfoPage` was dense prose and technical architecture surfaces, with little visual continuity with the updated homepage.
2. **New hierarchy:** editorial hero → sky permissions section → apricot human-review section → supported connections → cobalt unknown-guidance loop and final CTA. Final CTA is integrated into the unknown-guidance section instead of repeating another giant blue block.
3. **Visual system:** the same `KnowledgeFlowScene` in AI mode: approved guidance → Opryn access check → selected-knowledge permission → compatible connection → retrieved context. Neutral ChatGPT/Claude labeled nodes are used rather than redrawing provider marks or treating library icons as supplied official artwork.
4. **Permissions/control:** actual repository capabilities are selected knowledge categories/items, excluded categories and existing workspace access rules. The visual uses actual category names and is clearly labeled “Example access policy,” not a real workspace policy. It does not invent Finance/Private HR permissions.
5. **Human control:** Proposal → Human review → Approved knowledge. The shared approval example illustrates the decision; the page explicitly says people approve, edit or reject company guidance.
6. **Connections:** supported ChatGPT/Claude Premium connections, existing AI through the secure Agent API, and configured Slack/Teams. Opryn supplies context; it does not build, host or train agents. Opryn entitlement does not change an external provider’s plan. Only explicitly supplied conversation context is learned. External AI controls its cache/final response; no rewriting previous conversations or correctness guarantee.
7. **Unknown guidance:** an unknown result is preferable to guessing. Routing is qualified by enabled escalation and authorization, reflecting the actual service policy/scopes. A person’s answer still requires review before becoming reusable knowledge.
8. **Mobile:** vertically arranged flow, stacked permission content, vertical review stages and compact connection rows. No pointer/hover dependency. Desktop, tablet and 390px layouts were inspected.

## Pricing page

1. **Source of truth:** `lib/billing/plans.ts` provides Core/Premium pricing and employee limits. `lib/billing/stripe.ts` controls whether annual billing and Checkout are configured. `lib/billing/trial.ts` supplies the actual five-day trial configuration and mapped plan. No price IDs, policy, cadence or entitlements were changed.
2. **Actual values:** Core $99/month, five employees plus owner; Premium $249/month, twenty employees plus owner. Configured annual equivalents remain $79/$199 per month, billed $948/$2,388 annually. Annual controls appear only when both actual annual Stripe prices are configured.
3. **Layout:** strong editorial introduction beside vertically stacked plan surfaces. Core is quiet white; Premium is apricot. Six short differences per plan, large prices, clear cadence and provider setup qualifications. No invented Free plan or popularity badge.
4. **CTAs:** unsigned users retain the selected plan and interval through signup → onboarding → Pricing. Signed-in owners/admins use the existing Checkout endpoint; non-admins are told to contact the owner. Pending UI uses the system/logo loader. A synchronous shared lock prevents cross-plan/rapid duplicate submissions. Only the confirmed Checkout URL triggers navigation; errors are visible rather than swallowed. No optimistic “success.”
5. **Billing toggle:** shared Motion selection pill when annual pricing is configured. Initial annual intent is accepted only when supported. Auto-checkout now respects that intent instead of silently reverting to monthly. No invented savings badge.
6. **Comparison:** collapsed initially; nine canonical feature rows appear on demand with Motion height/opacity. Persistent ARIA targets remain valid while collapsed. The small-screen table fits the available width.
7. **FAQ:** compact accordions for actual trial eligibility/terms, upgrading, Premium-to-Core changes, seat counting and explicit AI-context sharing. Trial days/plan are shown only from valid server configuration; otherwise onboarding is identified as the place to confirm available terms. No false card-free, $0-today, cancellation or universal-integration guarantee.
8. **Mobile:** stacked readable plans, compact disclosure copy, large CTAs, accessible comparison/FAQ toggles. No horizontal overflow at 390px or 768px.
9. **Billing limits:** no paid Stripe session or financial transaction was executed. Actual signed-in payment, renewal and webhook behavior is outside this visual QA. The local environment does not enable the annual/trial branches, so their configuration gating and handoff code were checked rather than a live purchase.

## Shared public system

1. **Components:** new `KnowledgeFlowScene`, its shared example sequence and `HumanReviewExample`; reused `EditorialHeading`, `EditorialAction`, `PublicAction`, `OprynAction`, `MotionTabs`, `ActiveIndicator`, Navbar/Footer and official artwork.
2. **Theme:** `components/marketing/public-editorial.css`, scoped to the three public pages, consolidates warm white #FFFCF7, ink #14213D, cobalt #2855F9, hover #2045CE, sky #EAF4FF, apricot #FFD5B5, coral #F27655 and muted #566279. It overrides old public-header/footer/mobile-menu colors without changing authenticated tokens.
3. **Motion reuse:** shared rolling CTA labels, small arrow travel and press feedback. Scene/card transforms are separately owned. No GSAP/Motion transform conflict, pinning, scroll hijack or long page story.
4. **Header/footer:** same components across all pages. Current-page links have `aria-current="page"` and a thin cobalt shared-layout indicator, explicitly overriding an older generic filled-tab rule. Homepage logo smooth-scrolls to top; other routes navigate home. Reduced motion uses immediate scrolling. The whole approved wordmark scales only slightly; it is not rotated or reconstructed. Footer positioning/copy use the same public identity.
5. **Accessibility:** one semantic H1 per page; scene H2 and card H3 hierarchy; descriptive group/article labels; explicit example labels; decorative rails/texture hidden; no auto-loop live announcements. Important status is visible text and the action label changes semantically. Keyboard toggles and Escape returning focus to the mobile-menu button were checked. ARIA controls have existing targets. Cobalt-section small copy was changed to warm white for contrast.
6. **Responsive/performance:** actual 390px, 768px and 1440px checks across all three pages. No horizontal overflow. Scenes pause offscreen/background; no AI Thinking Orb is used for a fake marketing operation. Existing below-fold artwork retains lazy loading and contain sizing.
7. **Implementation guidance:** the Next.js/React guidance kept trial configuration on the server, browser motion in small client components, pointer movement outside React render state, and cleanup/focus semantics explicit. Full-flow verification checked rendered pages, resumable URLs and the API authentication boundary without creating a paid subscription.

## Verification

- Typecheck: `npm run typecheck` passes.
- Lint: `npm run lint` passes.
- Production build: `npm run build` passes, 120 routes generated.
- Original-asset/homepage verification: 35 checks pass.
- Public-flow SSR, billing source, resumable handoff, safety and destinations: 50 checks pass.
- Playwright **request-only** regression suite: seven tests pass. Anonymous Checkout is rejected before Stripe; no account/payment mutation.
- Existing browser regression selectors were updated to match the current editorial hero and pricing copy. The full legacy browser suite was not run; rendered UI was exercised through the connected browser.
- Browser console: no captured error-level logs during the final UI check.
- `graphify update .` refreshes the AST graph after implementation.
- Real reduced-motion source/SSR/static/pause behavior was reviewed. OS media emulation was not available through the connected browser API; no claim of a fully automated reduced-motion browser run.
- Screen recordings were not available through the connected browser. Pending/success screenshots are supplied instead; no synthetic video was substituted.

## Screenshots

All are actual browser captures; the preparation script crops screenshots only, never the supplied artwork.
The small blue mouse marker visible in some captures belongs to browser automation, not a custom Opryn cursor or site glow. Final desktop/mobile page captures use the local production build; tablet and pending/success diagnostic captures were taken during development.

- Desktop Home: `artifacts/public-flow-redesign/home-desktop-hero.png`
- Signature cobalt section: `artifacts/public-flow-redesign/home-cobalt-section.png`
- AI hero: `artifacts/public-flow-redesign/ai-desktop-hero.png`
- AI permissions: `artifacts/public-flow-redesign/ai-permissions.png`
- AI human review: `artifacts/public-flow-redesign/ai-human-review.png`
- Pricing hero/plans: `artifacts/public-flow-redesign/pricing-desktop-plans.png`
- Mobile Home: `artifacts/public-flow-redesign/home-mobile-hero.png`
- Mobile AI: `artifacts/public-flow-redesign/ai-mobile-hero.png`
- Mobile Pricing: `artifacts/public-flow-redesign/pricing-mobile-plans.png`
- Mobile contact sheet: `artifacts/public-flow-redesign/mobile-pages.png`
- Full-page and tablet captures remain in the same directory.

## Remaining limitations

No missing supplied artwork, new provider setup or migration is introduced by this change. React Bits was intentionally not added. Provider compatibility still depends on existing product support and the external account’s eligible plan/surface. Financial transaction/webhook validation and OS reduced-motion emulation remain unexecuted. Recording is unavailable. **Nothing has been deployed.**
