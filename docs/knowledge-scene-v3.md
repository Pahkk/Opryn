# Opryn authority-layer scroll story — v3

## Scope and architecture

Public homepage signature story and adjacent differentiation only. Authentication, billing, integrations, and knowledge services were not changed. The latest request explicitly authorized deployment after verification.

Updated components:

- `components/marketing/knowledge-centerpiece.tsx`: accessible HTML, persistent rule object, six-stage progress rail, custom Opryn endpoint icons, feedback loop, four editorial comparisons, `useGSAP` lifecycle and resize resume.
- `components/marketing/knowledge-centerpiece-motion.ts`: one desktop master timeline; measured Flip hub placement; masked headline choreography; SVG routing; reversible approval; feedback and final handoff.
- `components/marketing/knowledge-centerpiece-mobile.ts`: natural scrolling, source/approval/endpoint sequences, feedback entrances, passive frame-batched progress tracking.
- `components/marketing/knowledge-centerpiece.css`: scoped editorial surfaces, endpoint rows, responsive rail, compact authority layout. Public overflow changed from hidden to horizontal clip so mobile sticky progress can work.
- `package.json` / `package-lock.json`: added `@gsap/react` 2.1.2. Existing GSAP 3.15.0 retained.
- `scripts/verify-knowledge-scene.mjs`, `scripts/verify-knowledge-motion-stress.mjs`, `scripts/record-knowledge-scene.mjs`: reproducible browser checks and recording.
- `graphify-out/`: regenerated architecture graph.

No database, migration, credentials, environment, or pricing changes. The existing dirty worktree was preserved; this release is not a clean-commit deployment.

## Choreography

GSAP plugins: ScrollTrigger, Flip, SplitText. React integration: `useGSAP`; lazily imported animation modules retain their own `gsap.context()` and revert cleanup. No DrawSVG dependency, WebGL, scroll smoothing framework, or second motion framework.

One desktop timeline uses these labels:

| Label | Timeline position |
| --- | ---: |
| intro | 0 |
| sources | 6 |
| search | 24 |
| converge | 38 |
| proposal | 53 |
| review | 62 |
| approved | 76 |
| distribution | 90 |
| feedback | 113 |
| difference | 136 |
| final | 143 |

Timeline finishes at 153. These positions are choreography units, not playback seconds; scroll determines timing.

Desktop activation: at least 1024px wide and 760px high, no reduced-motion preference, and no manual static mode. Pin starts 88px below the viewport top, leaving navigation usable. Scroll distance is `clamp(2800, innerHeight * 3.8, 3800)` pixels: **3420px at 900px viewport height**. Scrub is **0.9**. The track reserves this distance before initialization; pin spacing is managed explicitly.

Four persistent source fragments translate inward, clip to their source headers, stack at 6px offsets, then move into a retained source rail as the operational proposal unfolds. The SAME article becomes Approved through masked status/label changes, perspective settling, metadata movement, and clipping. Flip.fit calculates a smaller authority-slot transform without reparenting or changing React business state. Five measured paths reveal endpoint rows sequentially.

The feedback scene preserves the general refund rule while explicitly identifying an unknown undelivered-order exception. It routes that gap to a person and shows a proposed update awaiting review, not an automatically approved rule.

The right rail uses raw ScrollTrigger progress for its continuous fill. Active/completed labels derive from the master timeline’s intro/proposal/review/approved/distribution/feedback label positions, following scrubbed visual time. It is decorative, non-clickable, and hidden from assistive technology. Number-only display is used on smaller desktops.

SplitText word masks wrap naturally across widths; the persistent outer HTML mask supplies whole-headline vertical replacements. No character announcements or duplicate semantic headings. Desktop resize debounces 180ms, recaptures the pin and Flip geometry together, and resumes an active reader’s scroll fraction. This fixes stale connector geometry from measuring an old pin width.

## Mobile and accessibility

- Below desktop thresholds, no pin and no desktop scrub timeline. Ordinary vertical reading order remains intact.
- Sources enter with a short directional stagger. One review object transforms into approved; outputs and feedback enter once.
- Compact sticky progress strip follows actual section reading progress; one passive scroll listener schedules a single animation frame.
- OS reduced motion and “Read without animation” render the full static source → proposal/review → approved → people/AI → feedback sequence.
- Essential copy is HTML. Review buttons and “Add for review” are explicitly illustrative, not fake interactive buttons.
- No-JavaScript and failed lazy-chunk cases retain the readable story without reserved dead-scroll space.
- Custom Calls, Team, Training and Connection icons are used. No AI sparkle/star icon is imported or rendered by this experience.

## Product-claim safeguards

Google selected files, uploads, selected calls, and owner answers are existing source capabilities. Notion and Confluence are NOT advertised here as live Opryn sources. The pricing sheet and call context are not cited as authority for refund limits; authority remains Refund Policy and Owner answer.

The question/answer and resolve routes support proposed rules, clarification and approval requests. The external answer path supports authorized approved-knowledge retrieval and unknown/escalation states. The story is an **example**, not a live integration test or automated financial action. Third-party caches and historical conversations are not claimed to update automatically.

Comparison is four open editorial rows, not checkmarks or exclusive-feature claims. It explicitly acknowledges other platforms’ search, connected context and governance.

References used for implementation/positioning:

- [GSAP React integration](https://gsap.com/resources/React/)
- [Flip.fit](https://gsap.com/docs/v3/Plugins/Flip/static.fit()/)
- [SplitText](https://gsap.com/docs/v3/Plugins/SplitText/)
- [Andy Reff](https://andrewreff.com/) and [SOHub](https://sohub.digital/): motion-quality references, not branding/layout templates.
- [Notion enterprise search](https://www.notion.com/help/enterprise-search) and [Atlassian Rovo](https://www.atlassian.com/software/rovo/features).

## Verification and evidence

- Production Next.js build passed (102 static pages generated).
- Typecheck and repository lint passed.
- Existing Playwright suite: **28 passed** (marketing, public product/auth entry paths, unauthenticated endpoint and webhook rejection tests).
- Story suite: **426 counted checks** in Chromium and WebKit at 1440, 1280, 1024, 768, 430 and 390px.
- Homepage suite: **119 checks**, including 320/360px, reduced motion, and no-JavaScript rendering.
- Additional motion stress suite: wheel, trackpad-like small deltas, reverse input, 1440→1280→1024→1440 resize with actual hub-edge/path-origin comparisons, Back navigation, mobile sticky progress, feedback, reduced motion.
- DOM identity of the approved rule stays unchanged through the timeline. Reverse scroll restores the source arrangement; route changes and static/reduced modes remove story pins.
- Reproducible recording: `artifacts/knowledge-scene-v3/signature-walkthrough.webm` (32-second forward scroll). Contact sheet: `video-contact-sheet.png`.

Screenshots in `artifacts/knowledge-scene-v3/` include Chromium/WebKit desktop sources, convergence, structured proposal, review, approved, distribution, feedback and final scenes. Phone examples include `chromium-mobile-progress-390.png`, `webkit-feedback-390.png`, and `webkit-difference-390.png`.

Issues found and fixed during QA: final caption collision, feedback path crossing text, narrow-desktop feedback clipping, mobile sticky containment, source-header cropping, and stale geometry on desktop resize. Recording/test input was corrected to avoid repeatedly restarting CSS smooth programmatic scrolling.

## Performance and remaining limits

Plugins initialize only when the section approaches within 600px; mobile/reduced mode never imports the desktop plugin module. No new images or fonts. Geometry is measured at initialization/refresh, not on every frame. Contexts, observers, resize timers and listeners are cleaned up. Rail updates do not trigger React rerenders. The choreography chunk measured about 2.8KB gzip; this excludes shared GSAP/plugin chunks and is not a total bundle claim.

WebKit is a browser-engine test, not a physical iPhone or installed Safari test. Wheel/trackpad input is automated, not physical-device QA. No field Core Web Vitals certification or live provider authorization/import/approval test is claimed. Desktop is intentionally a longer story; visitors can skip it or switch to static reading.

The full public regression suite safely rejected unsigned Slack/Teams requests; local post-response audit logging reported missing server billing storage configuration. This is an existing local-environment limitation, unrelated to this homepage change. `npm install` also reported 28 dependency advisories (1 low, 6 moderate, 20 high, 1 critical) in the existing dependency tree; broad dependency remediation was not attempted in a motion-only release.

## Release

Production release: **READY** at [www.opryn.app](https://www.opryn.app).

- Deployment: `dpl_DXXm43aPpuqgCkJTJQV1cQbWCner`
- Immutable URL: `https://handoff-r4ecvlgcz-nikitas-projects-acfaddb7.vercel.app`
- Framework: Next.js 16.3.5; remote build completed in 45 seconds.
- Git baseline: `fe02268` plus the existing working tree and this change; no commit was created.
- Live smoke: `/`, `/login`, `/pricing` returned 200; signed-out `/app/needs-you` returned 307 to login.
- Live Chromium: desktop 1440px distribution and mobile 390px unpinned story passed, with no page errors or horizontal overflow. Screenshots: `live-1440.png`, `live-390.png`.
- Initial scoped error scan (`vercel logs <deployment> --level error --since 5m --limit 10`): no logs found. This is a short post-release scan, not a long-term monitoring guarantee.
- Log drains and ongoing monitoring configuration were not audited or changed.

Previous production / rollback target:

`dpl_JDkwYt8afw8vYSuurF17sQqzLHfq`

`https://handoff-7cjedrhde-nikitas-projects-acfaddb7.vercel.app`

No production migrations are required.
