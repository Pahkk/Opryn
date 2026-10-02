# Opryn scroll-story refinement

Scope: the existing homepage `#how-it-works` section only. No deployment, schema changes, new integrations, or billing/authentication changes.

## Audit and decisions

- The old desktop scene used a roughly 38%-wide card, a fixed 650px stage, and large `clip-path` cuts during convergence/approval. This produced the small, cropped composition in the supplied screenshot.
- Sources moved with guessed offsets while a separate knowledge card appeared. The replacement uses the document's actual DOM shell as the proposal, approved rule, distribution hub, and final Opryn node.
- Headline animation split words rather than lines. It now uses line masks inside one anchored visual container, with one stable semantic H2.
- The progress rail used different timing from the start of convergence. It now derives stage positions and active states from the master labels.
- The existing lower-page product-proof section performs a global ScrollTrigger refresh when initialized. Refresh can restore a timeline with callbacks suppressed; the story now explicitly resynchronizes its rail after refresh.
- The existing GSAP installation, lazy-loading architecture, slate tokens, Opryn artwork, and Google provider marks were retained. No competing framework or new package was added.

## Components and files

- `components/marketing/knowledge-centerpiece.tsx`: existing section entry point, lazy initialization, responsive/reduced-motion lifecycle, static-reading control.
- `components/marketing/knowledge-scene.tsx`: new extracted semantic scene markup; shared document/knowledge shell; source fragments; consumer endpoints; knowledge-gap return; final loop.
- `components/marketing/knowledge-centerpiece-motion.ts`: desktop choreography, measured layouts, connectors, progress, cleanup.
- `components/marketing/knowledge-centerpiece-mobile.ts`: normal-flow entry gestures and compact sticky progress.
- `components/marketing/knowledge-centerpiece.css`: recomposed canvas, typography, shared card, editorial endpoints, responsive/static layouts. Existing Why Opryn styling retained.
- `scripts/verify-knowledge-scene.mjs`: updated browser regression coverage and screenshot capture.
- `scripts/verify-knowledge-motion-stress.mjs`: updated wheel, resize, reverse, and route recovery checks.
- `scripts/record-knowledge-scene.mjs`: updated full-scroll recording.
- `scripts/smoke-knowledge-release.mjs`: updated scene positions/selectors for future release verification; not used to deploy.
- `graphify-out/`: refreshed with `graphify update .`.

## GSAP implementation

Existing packages: GSAP 3.15.0 and `@gsap/react` 2.1.2. Plugins: ScrollTrigger, Flip, SplitText. SVG connectors use standard stroke dash animation; no DrawSVG, WebGL, Three.js, Lenis, or new dependencies.

One desktop master timeline, 100 editorial units:

| Label | Position | Story |
| --- | ---: | --- |
| information | 0 | Four asymmetrical source fragments enter |
| structure | 14 | Sources physically converge and stack; the document expands into proposed knowledge |
| review | 31 | Camera push and explicit human-review controls |
| approved | 46 | Same object changes status, compacts, retains sources, and gains version metadata |
| use | 60 | Pull-back; five paths draw and reveal their endpoints sequentially |
| learn | 82 | Unknown question returns; Operations answers; a proposed update returns for review |
| final | 97 | The same central object compresses into the final learning-loop node |

Scroll distance is `clamp(4500, innerHeight * 5.4, 5200)` pixels: **4860px at 900px viewport height**. Scrub is **0.9**. Pin begins 88px below the viewport top to retain the existing navigation. Short reading holds are included after convergence, during review, after approval, and after distribution.

### Shared-element transitions

1. `Flip.getState` captures CSS-authored layout probes. `Flip.fit(..., { getVars: true })` resolves the real source/stack/proposal/review/approved/hub/learn geometry. Explicit from/to tweens interpolate those measured states on the **same document DOM node**, so arbitrary seeks and reverse scroll do not depend on one-way class-change callbacks.
2. Source fragments use the same measured stack transition, then settle into retained context strips.
3. `Flip.from` reflows source metadata during approval. Review controls collapse and the status label changes within its existing container. A single SVG perimeter sweep finishes the transition.
4. The approved card remains stable while paths draw from its measured edges, then moves into the incoming-question and final-loop compositions.

### Headline and progress behavior

SplitText uses `type: "lines"`, `mask: "lines"`, and `autoSplit: true`. Animations are authored in `onSplit`, returned for cleanup, and attached to the same master timeline. Outgoing lines move upward; incoming lines rise through their masks. Visual copies are aria-hidden; product explanation remains in semantic HTML.

The vertical rail uses actual timeline time. Its markers are positioned using the stage-label offsets; fill and traveling marker follow the smoothed playhead. The active number, label, and `03 / 06` counter update together. Refresh explicitly resynchronizes these values even when GSAP suppresses animation callbacks.

## Mobile, accessibility, and recovery

- Full pinned scene requires at least 1024px width **and 820px height**. Tablets, phones, and short desktop windows use the readable normal-flow sequence.
- Mobile uses restrained source/card/endpoint entry gestures, a sticky compact progress line, and a vertically arranged final loop. It does not reproduce the desktop morph or impose a long pin.
- Reduced motion and the “Read without animation” control show all stages statically: no pinning, SplitText, Flip, or path drawing. JavaScript-disabled rendering also remains readable.
- Example Approve/Edit/Deny/Add for review labels are not live actions. No business records or external services are modified.
- Scoped contexts, SplitText instances, observer/listener cleanup, generation guards, and resize recapture prevent orphaned pins. Failed lazy-module loading falls back to static content. There are no AI stars/sparkles in the affected components.

## Verification

Final local production build:

- `npm run build`: passed; all 110 static pages generated.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- `verify-knowledge-scene.mjs`: **550 assertions passed** in Chromium and WebKit at 1440, 1280, 1024, 768, 430, and 390px.
- Native wheel and small trackpad-like deltas, reverse scroll, same-breakpoint resizing, mobile sticky progress, Back navigation, and reduced-motion checks passed in both engines.
- Failed lazy-chunk loading: readable static fallback passed.
- 1440 × 800 short-window fallback: unpinned rendering passed.
- Chromium 4× CPU throttling: forward/reverse sequence completed without stuck content or horizontal overflow.

These are real browser tests of **illustrative marketing UI**, not live knowledge-service integration tests. WebKit coverage is not a claim of testing physical Safari devices or a physical trackpad.

## Captures

Desktop production screenshots:

- [Information](../artifacts/story-redesign/chromium-1440-information.png)
- [Convergence](../artifacts/story-redesign/chromium-1440-convergence.png)
- [Proposed knowledge](../artifacts/story-redesign/chromium-1440-proposal.png)
- [Needs Review](../artifacts/story-redesign/chromium-1440-review.png)
- [Approved](../artifacts/story-redesign/chromium-1440-approved.png)
- [Distribution](../artifacts/story-redesign/chromium-1440-distribution.png)
- [Knowledge gap](../artifacts/story-redesign/chromium-1440-knowledge-gap.png)
- [Return to review](../artifacts/story-redesign/chromium-1440-return-to-review.png)
- [Final learning loop](../artifacts/story-redesign/chromium-1440-final.png)

Mobile:

- [390px review](../artifacts/story-redesign/chromium-390-proposal.png)
- [390px learning loop](../artifacts/story-redesign/chromium-390-loop.png)
- [430px sources](../artifacts/story-redesign/chromium-430-sources.png)
- [Reduced motion](../artifacts/story-redesign/chromium-reduced-motion.png)

[Desktop recording](../artifacts/story-redesign/signature-walkthrough.webm): 32-second continuous scroll, approximately 34 seconds including setup. Recording frames were inspected in-browser at six timestamps. Still screenshots are sharper than compressed video.

## Performance and remaining limitations

- One desktop ScrollTrigger; no per-frame DOM measurements, React state updates, perpetual loops, or large animated filters.
- Geometry is measured during initialization/resize, not on every scroll event. Most animation uses transforms, opacity, and SVG strokes. The finite shared-object morph also animates width/height; it is intentional rather than continuous page-layout animation.
- The desktop choreography chunk is about **9.1KB minified / 3.3KB gzip**, excluding already-existing GSAP plugin chunks and shared UI/CSS. No before/after field Core Web Vitals measurement was taken; the 4× CPU test is a functional stress check, not a CWV certification.
- Phone layouts intentionally prioritize reading over desktop-style morphing. Physical Safari/iOS and real-device touch/trackpad testing remain useful before release.
- The sequence is explicitly an example workflow. It does not promise automatic financial actions, automatic publication, or rewriting old external conversations.
- No deployment was performed. Prior favicon changes and unrelated worktree changes were preserved.

Implementation references: [GSAP Flip](https://gsap.com/docs/v3/Plugins/Flip/) and [SplitText lifecycle/masking](https://gsap.com/docs/v3/Plugins/SplitText/).
