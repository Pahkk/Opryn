# Inside Opryn: sharpness and scroll refinement

The old 1× captures were enlarged on retina displays and compressed again by
the image endpoint. Captures now use deviceScaleFactor 3 and lossless WebP:
3540×2400 desktop, 1170×2400 phone. New filenames avoid stale image caches.
Desktop files are 134–155 KB each; phone files are 66–71 KB each.

Next Image retains dimensions, alt text and lazy loading. A picture source
selects phone artwork without downloading a second hidden image. These already
optimized text-heavy files bypass lossy recompression intentionally. Screenshot
capture uses actual components with sample data, not customer information.

Desktop uses one lazy-initialized GSAP ScrollTrigger timeline: Teach → Knowledge
→ Needs You → Connections. Each incoming view reveals upward through a mask
while the outgoing view recedes slightly. No image scaling or blur filters.
The preview remains in place below the navigation. Scroll distance is 2.3
viewport heights, capped at 2400px, scrub 0.55. The line tracks the timeline;
keyboard-accessible buttons seek the corresponding stage using native scroll.

Phones use normal vertical figures with once-only masked entrances. Reduced
motion, short viewports, unavailable JS and failed motion/image initialization
retain the static HTML sequence. GSAP matchMedia/context cleanup removes pins,
inline styles and accessibility overrides on breakpoint/preference changes and
unmount. Images decode before the desktop layers are assembled.

Changed: product-proof.tsx, new product-proof.css, capture-product-proof.mjs,
eight retina WebP assets, updated public-refinement regression tests, and new
verify-product-proof.mjs. No packages, backend or pricing changes.

Verification: production build, typecheck, lint, all 38 regression tests;
Chromium/WebKit at 1440, 1024, 390 and 430px covering views, reverse navigation,
keyboard seek, image dimensions, resize, reduced motion and route cleanup.
Screenshots: artifacts/product-proof-scroll/. No deployment performed.

References used: GSAP ScrollTrigger and gsap.matchMedia documentation:
https://gsap.com/docs/v3/Plugins/ScrollTrigger/
https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
