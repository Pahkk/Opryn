# Motion product architecture release — September 15, 2026

## Production

Deployed successfully to https://www.opryn.app. Vercel deployment `dpl_JAqX7isNvJkqGGJKeSoXz5n4f9CY` is READY (Next.js, production build approximately 1 minute). Deployment URL: https://handoff-g0xo4qzf3-nikitas-projects-acfaddb7.vercel.app. Uploaded working tree based on `c30317c`; no Git commit was created.

Post-deploy Chromium checks: homepage, pricing and integrations returned 200 with Motion-owned nodes and no horizontal overflow; 390px pricing also had no overflow. Anonymous `/app` redirects to `/login`. No client exceptions observed. Deployment-filtered error log query returned no entries; this is a short smoke-test window, not ongoing monitoring. Drains/monitoring configuration was not audited. Live mobile screenshot: `artifacts/motion-product/live-pricing-390.png`.

## Implementation

Motion 13.3.0 is installed using `motion/react`. See [motion-system.md](motion-system.md) for ownership, exact primitives, surfaces and intentional boundaries. GSAP 3.15.0 and @gsap/react remain for storytelling. No database migration or new environment variable is required by this motion pass.

Primary files:

- `lib/motion/motion-tokens.ts`, `use-product-motion.ts`.
- `components/motion/`: MotionRegion/StaggerList, MotionNumber, MotionProgress, MotionPanel/MotionHover, MotionButton, PresenceSwap, MotionTabs/ActiveIndicator, SelectionTrack, TeachWorkflow, DecisionReceipt. Story components retain their GSAP timelines.
- `components/app/`: DialogSurface, DashboardPulse, DashboardDecision, AskOpryn, OwnerAnswer, NeedsYouCenter, KnowledgeLibrary, TeachSources/TeachGoogle/TeachProvider, IntegrationsCatalog, SettingsLayout, AccountForms; `app/app/page.tsx`.
- `components/guide/opryn-guide.tsx`, onboarding ActivationOnboarding/SetupContext/PlanChoice, OprynStatus.
- Public Navigation, MarketingFAQ, PricingPage, PublicIntegrations, ProductProof indicator; KnowledgeCenterpiece ownership attribute only.
- Shared motion CSS, Teach source expansion CSS, package/lock files, browser test fixtures and these docs.

`layout` is confined to small changing lists, contexts and panels. `layoutId` is scoped by local LayoutGroups for selected indicators and dashboard semantic continuity, not unrelated routes or portals. AnimatePresence owns keyed list removals, status changes, panel expansions and confirmations. useSpring/useTransform own real counters/progress. No new useScroll: existing scroll ownership stays with GSAP.

## Verification

- Production build: passed, 113 static pages.
- TypeScript: passed. ESLint: passed with zero allowed warnings.
- Motion primitive browser suite: 108 assertions, six widths, rapid updates, account and OS reduced motion, native dialog focus, hidden-tab recovery, cleanup and 4× CPU throttling.
- Product-motion browser suite: 66 assertions at 1440, 1280, 1024, 768, 430 and 390px. Real components with explicit API fixtures: inline Teach selection, filtering, Needs You resolution, Knowledge drawer, Home approval receipt.
- Settings: 100 assertions; activation: desktop/mobile, reduced motion, Explain→review→approve→answer, saved-source resume and inline Google fixture flow passed.
- Broader product UI suite: 230 assertions passed at 320/375/390/430/768/1280/1440px, with explicit provider/service fixtures.
- Guide server and browser suites passed, including cross-route guidance and mobile/reduced-motion cases.
- GSAP story stress and product-proof suites passed in Chromium and WebKit: reverse scroll, resize alignment, route cleanup, mobile and reduced motion.
- Public layout suite: 42 page/width combinations and 18 internal destinations passed.
- Screenshots visually inspected; sampled recording frames inspected for continuity. Browser automation is not a physical trackpad/device test.

## Artifacts

- `artifacts/motion-product/teach-expanded-1440.png`, `teach-expanded-390.png`.
- `artifacts/motion-product/needs-resolved-1440.png`, `needs-resolved-390.png`.
- `artifacts/motion-product/knowledge-detail-1440.png`, `knowledge-detail-390.png`.
- `artifacts/motion-product/home-1440.png`, `home-390.png`.
- WebM recordings: `artifacts/motion-product/recordings/`, `artifacts/motion/recordings/`.
- Adjacent screenshots: `artifacts/activation/`, `artifacts/guide/`, `artifacts/settings-foundation/`, `artifacts/premium-public/`, `artifacts/product-proof-scroll/`.

## Performance / limitations

An isolated minified bundle of MotionRegion, StaggerList and MotionProgress with React external measured 150,590 bytes / 50,806 gzip bytes, including Motion. This is not a measured production-route delta; no before-build baseline was retained. Lists above 40 elements skip entry/layout work; stagger is capped at 120ms. No continuous animation is added to static app content.

No known animation-owner conflicts remained in exercised flows. Native dialog closing stays immediate for focus restoration and Google Picker handoff. No cross-portal row flight or delayed route exit is attempted. About/Security/Contact remain restrained rather than acquiring decorative motion.

Authenticated flow tests use explicit fixture services: they do not prove a fresh live OAuth authorization, Stripe purchase, or production knowledge mutation. No customer data was modified to demonstrate animation. Existing third-party configuration and existing npm audit advisories were not changed by this release.
