# Public flow redesign — pre-edit audit

> Historical pre-edit audit. Core/Premium amounts below are no longer current; public pricing is Starter $49/month and Pro $129/month. See [deployment pricing status](deployment.md#september-19-2026-price-cutover-status).

Scope: homepage hero, public AI and Pricing. No authenticated UX, billing configuration, original artwork changes or deployment.

- Live homepage and repository agree: the hero uses a large nested `KnowledgeDemo` with three stage tabs and repeated explanatory copy. Keep the left-hand positioning, CTAs and all three supplied marketing images; replace only the hero visual.
- AI uses the older `PublicInfoPage` prose-led layout, multiple boxed architecture/lookup examples, developer terminology and a separate type/color hierarchy. Replace it with editorial sections and a concise, permission-controlled knowledge flow. Label conceptual examples explicitly.
- Pricing uses equally weighted columns, an always-expanded comparison and long feature lists. Preserve its authenticated owner gating, existing Checkout endpoint, resumable signup and conditional annual billing; make primary choices asymmetric and comparison optional.
- Pricing source: `lib/billing/plans.ts`: Core $99/month ($79/month equivalent annually), Premium $249 ($199 annually), 5/20 employees plus owner. `stripe.ts` enables annual only when both configured price IDs exist. `trial.ts` and Checkout implement an eligible five-day trial, with configurable payment-method collection; do not promise card-free access or $0 today.
- External AI permission policy supports subject/item selections and subject exclusions, with existing scope restrictions still applied. Illustrate actual categories, not invented department permissions. MCP unknown-answer routing additionally depends on workspace settings and escalation authorization.
- Exact separate approved Opryn mark exists as favicon artwork. Reuse it without redrawing. No React Bits package/components were found; use the installed Motion system instead.
- Shared motion: `OprynAction` controls pending/success and uses the supplied Approved image via `SuccessCheck`. Reuse it for explicitly labeled local examples, with no simulated backend success claim.
- Build shared public-only theme and flow primitives first. Reduced motion settles all nodes; loops pause offscreen, in background tabs and via a visible pause control. Pointer movement uses motion values, not per-frame React state.
