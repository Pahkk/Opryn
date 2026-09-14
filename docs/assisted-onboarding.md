# Assisted onboarding — implementation audit

## Release status — September 14, 2026

Approved for deployment by the owner and promoted to `https://www.opryn.app`.
Deployment: `dpl_6wk3MgzYePTCXBj5UsuySQYQGjZf` / `handoff-etroe5254-nikitas-projects-acfaddb7.vercel.app`.
Rollback deployment retained: `dpl_AB9WacPh3WcLH8oPdjBVV2M1U79N`.
Deployed the local working tree based on `fe02268`; this is not a claim that every released change was committed.

Applied `20260915010000_assisted_activation.sql` after a dry run confirmed it was the sole pending migration. Read-only production SQL confirmed its version, required billing columns and activation/checkout functions. No customer data was deleted. The Supabase CLI could not refresh its optional local Docker catalog cache; the remote migration completed successfully.

Vercel production build passed. Isolated migration, Checkout and webhook regression tests passed again. Real hosted Stripe Checkout, Google import and OpenAI journey verification remain outstanding; deployment does not convert fixture results into real integration results. The pre-deployment notes below are retained as historical context; migration and deployment approval are now complete.

## Baseline
- Next App Router / React 19; Supabase authentication, selected-workspace cookie and owner/admin checks. Keep these.
- ActivationOnboarding already embeds TeachWorkspace, contextual Google OAuth/Picker, real ingestion, ProcessReview and sourced Ask. CompanyProfileFields is shared with Settings; save_company_profile uses revision checks.
- Existing five-stage flow finishes immediately after an answer. Welcome is a list of identical boxes; industry is free text; no embedded assistance.
- OpenAI Responses structured parsing already powers Guide. Reuse its client/model configuration; no additional AI SDK, state store or tour library.
- Stripe Checkout already maps Core/Premium monthly/annual environment prices, reuses a customer, verifies signed webhooks and offers a portal. Current Premium checkout implicitly starts 14 days, including intended immediate purchases. Core has no trial. Checkout needs explicit intent and concurrency protection.
- Subscription access currently defaults to Core without an active subscription. This is legacy behavior, not evidence of a marketed free tier. Do not silently change existing customer entitlements.
- No verified safe website-fetch service was found for onboarding. Website stays an optional profile field, not a pretend crawler.

## Implementation sequence
1. Curated industries, validated suggestions and canonical profile persistence.
2. Editorial welcome / assisted Company Setup, using existing motion and source flows.
3. Persistent post-answer billing choice; explicit five-day Premium trial versus immediate purchase; server-owned checkout reservation and webhook state.
4. Regression tests, rendered desktop/mobile checks, production build. No deployment or production migration without approval.

## Safety boundaries
Suggestions are editable proposals, not business facts or approvals. No policy generation or permissions changes. Stripe return parameters never grant access. Existing organizations are not silently put behind a new paywall. No live charges or Stripe product creation during verification.

## Delivered architecture

Welcome → Company Setup → Teach → Review → Try → Choose how to continue → completion.

- `components/onboarding/activation-onboarding.tsx` remains the orchestrator. Teach, contextual Google sheet, ingestion, ProcessReview and Ask reuse existing production components.
- `company-profile.tsx` remains shared with Settings. Suggestions are generated through `/api/onboarding/suggestions`, validated against `lib/onboarding/suggestions.ts`, and only applied to editable fields after acceptance. Saving still uses the canonical revision-checked profile RPC.
- `lib/onboarding/industries.ts` adds 16 normalized broad industries while reusing aliases from the existing detailed `onboarding-catalog.ts`. Local keyword/prefix matching is instant; explicit “Help me choose” invokes assistance. Other supports a custom label. Existing industry labels are retained.
- Suggestions include description, industry, departments, knowledge areas, a first source and first question—not approved policy. Rate limiting is atomic, per authenticated user. No new AI SDK or state library was installed.
- `welcome-story.tsx` and `setup-context.tsx` use the existing GSAP infrastructure, path drawing and a persistent company/approved-context object. Reduced motion removes transforms. This is not a full Flip morph between every large workflow panel.
- `plan-choice.tsx` reads live configured Stripe amounts through `/api/billing/options`. It polls `/api/billing/status` after return; URL parameters alone cannot complete onboarding.

## Billing policy and required configuration

Existing code defines Core and Premium; the actual Stripe catalog could not be inspected. Production Vercel secrets are non-exportable and no Stripe test secret is available locally. Do not interpret fixture prices as verified Stripe prices.

Required existing variables:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CORE_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`
- `STRIPE_CORE_ANNUAL_PRICE_ID`, `STRIPE_PREMIUM_ANNUAL_PRICE_ID` when annual billing is offered

Optional new variables:

- `STRIPE_TRIAL_PRICE_ID`: defaults to the configured Premium monthly price, preserving the existing Premium trial policy. Overrides must match a configured Opryn price.
- `TRIAL_REQUIRES_PAYMENT_METHOD`: defaults to `true`, preserving current card collection. Stripe charges after exactly five days unless canceled. Explicit `false` uses `if_required` and cancels at trial end if no payment method exists.

Prices must be active USD recurring prices with the matching monthly/yearly interval. No products or prices are created automatically. Existing trials are not shortened retroactively. Immediate purchase omits trial parameters entirely.

Checkout uses organization customer reuse, a service-owned database lease, durable Stripe idempotency keys, existing-session reuse and Stripe subscription-history checks. Trial consumption is monotonic. A completed old Checkout may be replaced only when its subscription is confirmed terminal.

Webhook endpoint: `/api/billing/webhook`. Configure in the correct Stripe environment:

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`
- `invoice.paid`, `invoice.payment_failed`

The endpoint verifies signatures, preserves event receipts/tombstones and retrieves current subscription state. The trial-ending event refreshes state; it does not invent an email delivery feature. Configure Stripe Customer Portal to permit intended payment/subscription management for the existing products. The existing `/api/billing/portal` creates server-side portal sessions.

## Migration and access

Pending migration: `20260915010000_assisted_activation.sql`. It has NOT been applied to production.

Adds normalized profile fields through the existing JSON/RPC model, suggestion rate-limit storage, checkout reservations, trial end and server-owned activation/billing fields. `record_activation_answer` verifies an actual approved source and sourced answer before recording activation. Client-editable wizard state is not an entitlement source.

Existing subscription rows retain legacy access. New workspaces may perform activation before billing; afterward the shared API boundary and Home require active/trialing server state. Settings/data controls remain reachable. This is not an exhaustive rewrite of every legacy read-only route or external retrieval service.

Apply the migration in staging before running the new API code: missing billing columns fail closed. Review migration and production sequencing before deployment. Additive columns can remain during an application rollback; do not drop profile or subscription data. Back up before any later destructive rollback.

## Verification and remaining work

Passed: typecheck, lint, production build; checkout/suggestions/webhook/Guide/cleanup adapter tests; actual migration/RPC checks in isolated PGlite. Webhook tests use real Stripe signature cryptography but mocked Stripe retrieval and persistence.

Rendered actual onboarding components at 1440 and 390px in Chromium, 360px reduced-motion Chromium, and 430px reduced-motion WebKit. Tests cover explicit suggestion acceptance and correction, Google sheet without navigation, Explain → Review → Approve → sourced answer → plans, failed Checkout recovery and saved-state resume. Provider responses and example company content are mocked. Screenshots: `artifacts/activation/` (`goal`, `company`, `teach`, `google-sheet`, `review`, `try`, `answer`, `plans`, `complete`).

Still required before production approval:

1. Supply Stripe **test-mode** configuration securely in the local/staging environment, never in chat. Run `scripts/inspect-stripe-setup.mjs` to inspect configured prices, webhook events and portal availability without creating products.
2. Exercise real hosted Checkout: five-day trial, immediate purchase, cancel/resume, delayed webhook, invoice failure, cancellation and portal. No live charges have been performed.
3. Apply and test the pending migration in staging; run a real Google import and real OpenAI-assisted setup/answer journey. Browser fixtures do not prove these provider integrations.
4. Approve deployment separately.

Known limitations: optional website is stored but not fetched; approval authority continues to use existing roles rather than an invented editable approver permission; full source-to-processing Flip choreography is not implemented; the single mobile Company Setup is still a vertically scrolling form. Initial unsaved pre-workspace input is not a durable cross-device draft. No claim of full accessibility certification or live Stripe end-to-end completion is made.

Current API references used: [Stripe Checkout trials](https://docs.stripe.com/payments/checkout/free-trials?payment-ui=stripe-hosted), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
