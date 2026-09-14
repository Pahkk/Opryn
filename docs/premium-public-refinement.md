# Premium public refinement — audit and plan

## Live baseline

Audited www.opryn.app in Chromium at 1440px and 390px: homepage, Pricing,
AI, About, Security, Contact, Privacy, Terms, login and signup. All returned
200 with no page exceptions or overflow. Evidence is in
`artifacts/premium-public/baseline/`. Homepage visible main copy is 1,098
words in reduced-motion mode. This pass must not be deployed without approval.

## Findings before implementation

- Story, Why Opryn, category contrast, central-update diagram and people copy
  repeat the same loop. Replace repetition with application proof.
- Hero already has one H1 and aria-hidden animation, but invisible sizing
  spans serialize every phrase. Remove duplicate text while preserving space.
- Integrations is only an anchor. Google copy describes manual links despite
  the selected-file Picker implementation. Status labels are inconsistent.
- AI needs an inspectable example. About (160 words) and Contact (102 words)
  are sparse. Shared typography exists but pages need stronger hierarchy.
- Pricing already positions people + AI, but nine bullets bury the actions.
  Preserve prices, employee limits, actual trial eligibility and checkout.
- Non-legal public pages lack canonicals. Contact inherits the home description.
- Existing app component fixtures can supply actual UI screenshots without
  customer data. Clearly label sample workspaces, not customer evidence.
- Social proof is correctly empty and reusable components already exist.
- Resend is implemented for invitations, not an abuse-protected public contact
  service. Do not claim a message was sent or expose an unprotected mail API.
- Legacy homepage components are unmounted. Preserve unrelated files; remove
  redundant mounted sections and unused imports in the current homepage only.

## Plan

1. Edit homepage, hero semantics and navigation; preserve the GSAP architecture.
2. Add real-component screenshot tabs and a searchable integrations route.
3. Refine AI, About, Security, Contact, pricing and route metadata.
4. Test browser layouts, reduced motion, keyboard, links, lint, types and build.

No backend, authentication, billing logic, schema or customer-data changes.

## Implemented

- Homepage copy: 1,098 → 877 visible main words (20.1% reduction, same
  reduced-motion measurement). Removed the separate central-update section
  and repeated people/photo section. Consolidated Why Opryn, shortened the
  final CTA and integration preview. Retained the immediate demo and complete
  GSAP story. Removed invisible rotating-phrase copies; one H1 and a stable
  accessible description remain, with pause and reduced-motion support.
- Inside Opryn: four manual, keyboard-operated tabs using screenshots of the
  actual Teach, Knowledge, Needs You and Connections components. Generated
  locally with `scripts/capture-product-proof.mjs` and the existing component
  fixtures. API calls are mocked, not production connections. Example workspace
  and sample knowledge are explicitly labeled; no customer results are claimed.
  Eight responsive WebP files total approximately 270 KB; the initial visible
  image is 24–39 KB before Next image optimization. Images lazy-load below fold.
- `/integrations`: searchable, categorized rows with expandable details,
  plain-language availability and real next destinations. Public visitors do
  not see invented private connection status. Their connection manager remains
  `/app/integrations`. Unsupported providers are not advertised as live.
- `/ai`: HTML access architecture and a labeled example lookup, source,
  revision and connection boundary; three concise builder benefits.
- `/pricing`: buyer-fit summaries, CTA before seven key capabilities, detailed
  comparison below. Existing prices, seat limits, trial eligibility and
  subscription handlers unchanged.
- `/about`: belief, scope and early-stage context without invented company facts.
- `/security`: at-a-glance controls, data flow and service-provider roles;
  existing permissions, media, deletion and certification caveats preserved.
- `/contact`: accessible, validated email-draft composer with topic links and
  the existing usersupport@opryn.app fallback. It does NOT submit a message.
- Shared compact navigation, useful integration destination, fuller footer,
  system typography, public-only slate tokens, focus treatment and consistent
  secondary-page spacing. Authenticated product identity is unchanged.
- Unique title, description, canonical, OpenGraph and Twitter metadata for
  the seven public product/company destinations. Empty social-proof data and
  existing reusable proof components remain empty.

## Files and routes

Primary edits: `app/page.tsx`, `app/{pricing,ai,about,security,contact}/page.tsx`,
`components/navigation.tsx`, `components/pricing-page.tsx`,
`components/brand/TypingHeadline.tsx`,
`components/marketing/{story-home,knowledge-centerpiece}.tsx`,
`lib/marketing/integrations.ts`, `app/globals.css`.

Added: `app/integrations/page.tsx`, `app/public-refinement.css`,
`lib/marketing/metadata.ts`,
`components/marketing/{product-proof,public-integrations,contact-composer}.tsx`,
`public/product-proof/*.webp`, `tests/public-refinement.spec.ts`,
`scripts/{capture-product-proof,audit-public-refinement,verify-public-polish}.mjs`.
Updated existing navigation assertions and story screenshot output/exit selector.

No migrations, package additions, provider changes or deployment. Rollback of
this pass requires only its public files/assets; preserve all unrelated worktree
changes. Next/React guidance informed isolated client boundaries, static proof
assets rather than shipping the dashboard, and scoped GSAP cleanup.

## Verification and evidence

- Production build, explicit TypeScript check and ESLint pass.
- All 38 desktop Chromium / mobile WebKit regression tests pass, covering navigation,
  auth entry/validation, safe unauthenticated API rejection, public metadata,
  product tabs/images, integration discovery and contact required fields.
  Typing layout stays stable across every phrase; pause remains functional.
- 486 continuous-story checks pass in Chromium and WebKit at 1440, 1280,
  1024, 768, 430 and 390px. Includes same-object continuity, source alignment,
  progress accuracy, reverse/rapid seek, breakpoint resize, unmount cleanup,
  reduced motion, no JavaScript and failed animation chunk fallback.
- 42 public layout checks at 375, 390, 430, 768, 1280 and 1440px: no overflow.
  All 18 internal destinations checked returned successful responses; anchor
  destinations exist. No purchase, actual OAuth authorization or email sent.
- Live baseline and local final page reports/screenshots:
  `artifacts/premium-public/{baseline,refined}/`.
- Hero, product proof, Why Opryn, connections, pricing and final CTA captures:
  `artifacts/premium-public/details/` (six widths), plus `checks.json`.
- Information, convergence, Review, Approved, Use, knowledge gap, Learn and
  final-story captures: `artifacts/premium-public/story/`.
  Full automated scroll recording: `story/walkthrough.webm`.

## Limitations / developer follow-up

- Direct contact delivery is not implemented. The existing email service is
  invitation-specific; adding a public send endpoint needs abuse protection,
  delivery configuration and monitoring. Current UI clearly prepares an email.
- Application proof is real component rendering with synthetic fixtures, not
  a live authenticated account or a real integration test.
- Google, communication providers, Stripe purchases and authenticated plan
  changes were not exercised. Marketing availability reflects implemented
  capabilities, not a claim that every production credential was tested.
- WebKit was tested; this is not a physical iPhone or manual Safari/VoiceOver
  certification. No field Core Web Vitals or formal WCAG compliance claim.
- Existing legacy marketing components/assets are left in the repository;
  they are not imported into the new homepage. No broad destructive cleanup.
- The established GSAP choreography was preserved, not rewritten. The scope
  here is editing, hierarchy, product proof and consistency.
- Production remains untouched. Approval is required before deployment.
