# Opryn public landing-page redesign

## 1. Audit findings

Inspected the live homepage accessibility tree and rendered first viewport, then the actual homepage, public navigation/footer, pricing config, demo, motion primitives and marketing assets. The former page repeated light environments and similarly scaled, text-led sections. Its labeled interactive example and real provider disclosures were useful and retained. No Base44 artwork or assets were copied.

## 2. Sections redesigned

Concise hero and existing revision-policy demo; full-width cobalt knowledge identity; editorial Team/AI composition; sky-blue three-step explanation; apricot knowledge-gap/approval loop; connections and compact trust; oversized product principle and image rail; config-backed Core/Premium pricing; cobalt final CTA. No authenticated pages or backend functionality changed.

## 3. Original artwork mapping

- `opryn_business_answer_pipeline.png`: cobalt signature section.
- `one_source_two_uses.png`: Team/AI section.
- `opryn_three_step_knowledge_flow.png`: How it works.
- `from_question_to_trusted_answer.png`: unanswered question → proposal → approval.
- `opryn_integrations_connection_page.png`: Connections.

All five SHA-256 hashes match the supplied originals. Bot/star details were explicitly allowed by the user. Main artwork uses contain and the original aspect ratio. All illustrative policies/workflows are visibly labeled examples, with accessible descriptions and capability clarification.

## 4–7. Visual language and motion

Warm white, cobalt, sky and apricot create deliberate environmental contrast. A partial broken-ring-inspired motif and faint dot grid are marketing-only. The four-image detail rail has different tile sizes, intentionally cropped details and spring-following movement at .35/.6/1/.5 rates. Main graphics track mouse position with Motion values/springs, at ±16px horizontal and ±8px vertical. Light-follow illumination is capped at a subtle .10 blue field. Separate wrappers own entrance, scroll translation/scale and pointer transforms. There is no scroll pinning, hijacking, GSAP or looping background animation.

## 8. React Bits

No React Bits package/components were available. Native Motion provides one-shot word entrance and clipped CTA label motion; no invented imports or extra dependency. No spinning text or scramble effects.

## 9–10. Actions and logo

Hero/final primary CTAs use an opt-in rolling label, 3px arrow movement and .97 press feedback with one accessible name. Existing actions elsewhere remain unchanged. The public navigation wordmark receives restrained whole-logo hover motion and returns the homepage to the top, using instant scroll for reduced motion. Other public routes navigate to `/`. The original wordmark was not rebuilt or separately rotated.

## 11–13. Mobile, accessibility and performance

Responsive layout switches to a single-column hero, stacked offers and two-column image rail. Fine-pointer mouse checks prevent touch parallax; mobile main graphics disable scroll transforms. Reduced-motion preference disables pointer transforms, overshoot, rolling labels and trace effects; content remains visible. One semantic H1; visible keyboard focus; decorative rail/lighting/trace hidden from assistive technology; actual provider limitations remain native readable text. Server composition retains HTML copy and plan data; client islands contain only interactions. Below-fold images are lazy, optimized through Next Image and reserve dimensions. No new WebGL/canvas, blur loops, continuous timelines or animation dependencies.

## 14. Visual QA

Rendered checks at 390, 768 and 1440px: no horizontal overflow, one H1, all five main images load and use contain, no pin spacers. Desktop/mobile full-page captures and hero/section artifacts are under `artifacts/editorial-marketing/`. Verified the user-driven hero Review → Approve → Use flow and logo return-to-top. Browser screenshots have a fixed-header capture artifact when taken while scrolled; screenshots are not customer activity. No motion recording was made. Reduced-motion paths were source-reviewed; OS reduced-motion was not independently emulated in the browser.

## 15. Validation

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed, 120 pages generated.
- `node scripts/verify-editorial-marketing.mjs`: 39 checks passed (original bytes, SSR, captions, privacy/provider copy, links/destinations and anchors).
- `graphify update .`: completed.

## 16. Remaining limitations

The supplied posters contain embedded headings, stylized provider marks and broad illustrative wording. Adjacent native text explains actual selected-source behavior, provider eligibility and human authority; the original artwork itself is unchanged. Poster body text is small on mobile, so essential meaning is repeated in accessible native copy. No first-time external reviewer, exhaustive screen-reader audit, Core Web Vitals benchmark or motion recording was available. The local dev browser emitted an LCP warning when loading directly into a below-fold section; below-fold images intentionally remain lazy for normal top-of-page visits. No deployment, billing changes, migrations or production writes were performed.
