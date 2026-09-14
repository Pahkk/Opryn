# Signature motion pass — September 13, 2026

## Implemented selectively

- Homepage headline uses a single semantic H1 and a 650ms masked reveal.
- Existing teaching explanation sequences source entry, review, approval and authorized use with thin SVG paths. This is an explanatory diagram, not live processing status.
- Existing central-update illustration sequences approved knowledge and paths to Team, ChatGPT, Support Bot and Call Agent. Authorization/caching caveats remain in HTML.
- Desktop update-section copy sticks within its own section, without pinning or scroll interception. Mobile remains ordinary vertical content.
- Feature panels respond to fine desktop pointers by at most 2px on each axis (less than 3px total). A separate transform surface prevents interference with section entry.
- Authenticated page entry adds restrained scale depth; status entry has a small confirmation morph.
- Needs You collapses a server-confirmed decision into a compact receipt in 300ms. Focus moves to a stable filter; decision actions remain disabled for 350ms to avoid double-clicking a moving next item. Receipts remain explicitly clearable.
- Needs You filters have an animated selection underline. Existing keyed list primitives animate changed rows and small repositioning of unchanged rows without remounting form state.
- Public navigation compresses from 76px to 64px after scrolling and restores on return.

## Retained / deliberately not expanded

Native dialog/mobile-sheet entrance, contextual Google Picker handoff, real metric changes and connection status transitions retain the previously verified system. No new expandable integration manager or 3D parallax was added in this selective pass. No ScrollTrigger dependency is required: IntersectionObserver handles finite entrance stories, CSS handles section-bounded sticky positioning. No new artwork, continuous loops, backend/schema changes or OAuth changes.

## Safeguards

GSAP context cleanup through the shared motionScope handles unmount, document hiding, OS reduced motion and the saved application preference. Essential content is rendered visible without JavaScript. React owns all business state; receipt animation starts only after successful API responses. Errors and sensitive settings retain immediate presentation.

## Verification

- Typecheck, lint, production build and git diff whitespace check passed.
- 90 GSAP/React lifecycle assertions at 360/390/430/768/1440px.
- 230 product component assertions including Teach/Google, Needs You and drawer flows; APIs and provider SDKs are explicit local fixtures, not live integration tests.
- 119 public homepage assertions.
- 82 signature motion assertions in normal and reduced motion at five widths, including actual pointer transform samples.
- Screenshots: artifacts/signature-motion/{teach,distribute}-{390,1440}.png and artifacts/product-ux/.
- graphify update . run after changes.

Rollback target before release: https://handoff-7k17n4ko1-nikitas-projects-acfaddb7.vercel.app (`dpl_AchYzuh2wyr6vjRqnHUbHh1cdVYx`).

Released to https://www.opryn.app as `dpl_6R4Km8WnuGEuKdfnjMuDnKMXWFV3` (production READY, 59s remote build). Immutable release: https://handoff-hk60vy02o-nikitas-projects-acfaddb7.vercel.app. No migrations or environment changes.
