# Public homepage motion refresh — September 16, 2026

Status: implemented and verified locally. **Not deployed.** Production remains unchanged. Built preview: http://localhost:3222.

## Live audit and confirmed failure

Inspected https://www.opryn.app in the connected Chrome browser and captured production with Playwright before editing. Sections: split hero + example, six-stage knowledge story, Inside Opryn, Why Opryn/category contrast, People/AI, integrations, trust, pricing, final CTA and footer.

The story's JavaScript AND CSS required `min-height: 820px` as well as desktop width. At the actual 1440×714 browser viewport, production had `data-mobile-story=true` and no desktop enhancement. At 1440×900 it animated correctly. This is a verified responsive gating failure, not evidence of a missing production plugin. No production console exception was observed.

Inside Opryn independently required 760px height; otherwise it became four stacked full screenshots with hidden navigation. On tall desktops it added another approximately 2,000px pinned sequence. This made the page's behavior and length vary substantially by laptop window height.

Other issues: hero demo auto-rotated, several layers competed in its hierarchy, product proof had no usable tab interaction in fallback layouts, people/AI compositions were nearly identical, integration rows could not explain their setup requirements, and trust states were entirely static. The lower page repeated the same operating loop, although its category contrast remains useful.

## Changes

1. **GSAP repair:** cinematic breakpoint now 1024px wide / 620px high. Compact geometry scales the knowledge content and measured card layouts together; headline/canvas/rail fit short windows. Matched JS/CSS breakpoints. Explicit centralized registration in `lib/motion/story-gsap.ts` for ScrollTrigger, Flip, SplitText and useGSAP. Existing scoped cleanup, resize snapshot rebuild and scroll-progress restoration remain. Font readiness precedes capture. Reserved-size story logos start loading near viewport entry without blocking initialization on image network requests. Development fallback errors are now observable.
2. **Motion version:** existing `motion` 13.3.0 reused. No dependency added, no React canary, WebGL or smooth-scroll layer.
3. **Public components:** `PublicAction`, `PublicReveal`, `HomeIntegrations`; rebuilt `ProductProof` and `SharedKnowledgeDemo`. Existing MotionTabs, ActiveIndicator, MotionPanel and StaggerList reused.
4. **Actions:** primary, secondary, text, icon and external variants; 240ms clipped rolling labels for principal CTAs, 3px arrows / diagonal external arrow, .985 press, visible focus. Visual duplicate labels are aria-hidden. Applied to homepage CTAs, directional links, plan links and shared navigation. Operational checkout behavior is untouched.
5. **Hero:** one semantic H1, existing GSAP masked entrance, stable accessible supporting sentence and Pause control. Compact refund-guidance example with user-selected Team/Connected AI answers. No simulated AI request or decorative thinking indicator; clearly labeled example.
6. **Product proof:** Motion-only, explicit tabs at every width, local layoutId indicator, AnimatePresence within one reserved-ratio window, keyboard arrows/Home/End, actual existing retina application captures. No auto-rotation or scroll seeking. Screenshots remain actual example-workspace UI, not fabricated customer proof.
7. **Editorial sections:** oversized Why numbering and connecting rule; asymmetric people/AI treatments and concise illustrative snippets; filterable, expandable supported-provider rows; user-selected trust-state explanation; consistent pricing/final CTA actions and restrained footer entry. No pricing/capability changes.

## Story architecture and ownership

One timeline / one ScrollTrigger for the signature story. Labels: `information:0`, `structure:14`, `review:31`, `approved:46`, `use:60`, `learn:82`, `final:97`. Scroll distance remains tuned to `clamp(4500, viewportHeight × 5.4, 5200)` pixels: 4,860px at 900px height, 4,500px on ordinary short laptops. Scrub: **0.9**. Pin starts below the fixed navigation at 88px.

The original Google document shell is the proposed/reviewed/approved knowledge object throughout. Flip.fit captures actual layout probes into reversible timeline geometry; Flip.from handles retained-source metadata reflow. Stable `data-flip-id` values identify sources and authority. SplitText uses lines, line masks, autoSplit and onSplit-created timelines. SVG paths draw sequentially and the unknown-question route reverses the visual flow.

Rail positions derive from timeline label boundaries; fill and traveling marker use the scrubbed playhead, so the rail matches the visible scene. Rail height adapts to the viewport. No arbitrary independent percentage switching.

`data-animation-owner="gsap"` marks the story; `data-animation-owner="motion"` marks public actions, reveals, demo and proof. Existing `data-motion-owner` remains compatible. No Motion transform ancestor surrounds the pinned story. No pinReparent hack was needed. GSAP normal-section reveal orchestration was removed from StoryHome.

## Mobile, reduced motion and accessibility

- Below 1024px or very short windows under 620px: readable vertical story, no long pin, compact sticky progress. All product stages remain present.
- Reduced motion: static story; product controls remain functional; no rolling-label motion or hover displacement. Screenshot/status changes are near-instant. One semantic hero H1 and stable fallback text retained.
- Product tabs use tablist/tab/tabpanel semantics and keyboard focus; navigation Escape handling retained; status meaning includes text, not only color. No custom cursor or new modal/toast system was added to this homepage.

## Verification

- `npm run typecheck`: passed.
- `npm run lint -- --max-warnings=0`: passed.
- `npm run build`: passed; 113 static pages. Production build also served locally for browser checks.
- `verify-home-refresh.mjs`: Chromium and WebKit passed six stages at 1440×900, 1440×714, 1280×720, 1024×768, 1280×620; reverse scroll, card bounds, mid-story reload, one pin, 768/430/390px normal mobile, keyboard tabs, mobile menu, hero choice, trust choice, integration filters, reduced motion and route return. No client exceptions.
- Existing GSAP stress suite passed on both engines: wheel input, trackpad-like small deltas, reverse, resize/path alignment, route return, mobile sticky progress and reduced motion.
- Product-proof regression updated for the intentionally changed interaction contract (tabs, not pin). Full public-page layout checks also run to cover shared navigation.
- `git diff --check`: passed. Graphify updated.

## Performance

Product proof now renders one screenshot instead of four and no longer eagerly decodes all four or adds a second ScrollTrigger/pin. Story imports remain near-viewport lazy. No layout animation on the entire page. No image/font dimension changes or new fonts. A single unthrottled localhost Chromium navigation measured CLS 0; this is a local sanity check, **not field Core Web Vitals or a production performance guarantee**. The authenticated application was not redesigned.

## Visual evidence

Before: `artifacts/home-refresh/live/`. After, from production build: `artifacts/home-refresh/local/`. Both include Hero, Information, Structure, Review, Approved, Use, Learn, Inside Opryn, Why, Integrations, Pricing, Footer, laptop fallback comparison and mobile/reduced captures.

Additional stage/geometry screenshots: `artifacts/home-refresh/qa/`.

Full native-wheel desktop scroll recording: `artifacts/home-refresh/full-scroll/page@bc62abd46a4e0a7b3fbcec9365432e65.webm`. Sampled-frame visual review: `artifacts/home-refresh/full-scroll/contact-sheet.png`. Recordings also accompany interaction QA.

## Remaining boundaries / rough edges

At the smallest supported desktop height, metadata is intentionally denser; very short windows use the readable sequence rather than forcing illegible pinning. A first visit to an unselected product tab still needs its real screenshot downloaded. Existing screenshots reflect their captured application version, not a live authenticated embed. Browser automation uses wheel/trackpad-like events, not physical hardware; WebKit is an engine check, not a physical Safari device. No live OAuth, payment or customer-data mutation was performed. Broader secondary-page layout redesign and experimental view transitions were intentionally excluded.

Reference patterns reviewed: [Motion examples](https://motion.dev/examples), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [Flip](https://gsap.com/docs/v3/Plugins/Flip/), [SplitText](https://gsap.com/docs/v3/Plugins/SplitText/). These informed lifecycle/ownership and interaction choices, not copied branding or layouts.
