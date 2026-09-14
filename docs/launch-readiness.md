# Public launch-readiness audit — September 9, 2026

## Scope and outcome

Incremental public-site refactor. No integration, authentication, approval, billing, or database architecture replacement. Green/gray theme and official logo retained. Homepage reduced from 15,029px to 10,524px at 1440px viewport in reduced-motion screenshots (~30%). The six-image gallery is now three purposeful visual moments; unused assets remain available but are not requested by the homepage.

Current story: hero → shared-policy demo → compact trust → learning → people/new hires → AI and policy-update demo → workspace break → knowledge layer → integrations → owner/expert learning loop → plan summary → security/early-customer links and FAQ → final CTA.

## Evidence-backed corrections

- `lib/billing/plans.ts`: Core $99/month, annual equivalent $79; Premium $249/month, annual equivalent $199. Pricing UI now uses these values instead of duplicating amounts. Annual checkout visibility still depends on configured prices.
- `app/api/billing/checkout/route.ts`: trial only on initial Premium checkout when `trial_used` is false; 14 days. Existing Stripe subscriptions go to the billing portal. No claim that every signup receives a trial.
- `app/api/team/invites/route.ts`: member count minus one owner plus pending invites. Core 5 employee seats; Premium 20. No extra-seat checkout. New invites blocked at the limit.
- `priorityProcessing` exists as a plan flag but no priority-processing implementation was found. Removed that marketing promise. Advanced API permissions are not marketed as Premium-exclusive without an implemented restriction.
- `lib/integrations/catalog.ts`: Drive/Docs currently use manual accessible-link or uploaded-copy import, not whole-account OAuth browsing or Google Picker. Privacy copy now makes the distinction from Google sign-in explicit.
- Slack and Teams OAuth routes and message processing exist, but customer/provider setup remains required. Twilio credentials/webhooks and remote MCP exist. Public registry is an audited allowlist drawn from the provider catalog; generic credential-only providers are not marketed as live integrations.
- `lib/twilio/processing.ts`: Twilio stored audio has conditional retention cleanup; transcripts/derived knowledge are distinct. Cleanup errors and maintenance execution prevent an absolute deletion guarantee. Manual uploads have no equivalent universal expiry.
- `lib/ai/services.ts`, `lib/ai/media.ts`: OpenAI processing, transcription, selected video frames, and embeddings. Privacy now names processing purposes and categories of providers without zero-retention or training guarantees.
- `lib/api.ts`, `lib/opryn/knowledge/retrieval.ts`, `lib/opryn/knowledge/trust.ts`: authenticated membership, organization-scoped retrieval, approval/conflict checks. Security page describes these controls without certification claims.
- `app/api/processes/[id]/route.ts`: process deletion is not a verified full-storage/account deletion workflow. Public copy does not claim otherwise.
- `lib/marketing/marketingProof.ts`: empty testimonial/logo/case-study/metric arrays; no proof section renders when empty. Homepage example-day metrics removed; remaining demos explicitly illustrative.
- Hero already used one H1, an accessible static description, and aria-hidden visual animation. These were preserved and regression-tested. Nonsequential section numbers removed.

## New destinations

`/security`, `/about`, `/ai`, `/contact`. Privacy and Terms updated; grouped footer links to product, company, legal, and account destinations. Public Sign In goes to the existing `/login` page. No new authentication mechanism.

## Verification and limits

- Typecheck, lint, production build, graphify update, and diff checks run.
- Homepage browser checks at 320, 375, 390, 430, 768, and 1440px. Three responsive images (two lazy), one accessible H1, reduced-motion fallback, no horizontal overflow, example consumer switching, typing stability and policy-update demo checked.
- Public route checker covers home, pricing, privacy, terms, security, about, AI, contact, signup, login at the same six widths. Checks keyboard menu dismissal/focus return, pricing→signup return path, local validation, and internal link responses.
- Screenshots: `artifacts/knowledge-home/` and `artifacts/launch-public/`.
- No screenshots or mock demonstrations count as evidence of a live integration.

## Launch gates requiring owner/operator confirmation

1. Confirm public support email and legal operator/founder identity. None was verified in the codebase; `lib/marketing/company.ts` deliberately has empty values. Contact page is not a verified working support channel until populated and email delivery is checked.
2. Verify live Stripe amounts/currency/active prices and an authorized checkout. Production secrets cannot be exported by Vercel; the read-only configuration audit could not access Stripe. Missing exported values do not prove missing production configuration. Do not treat the code prices as verified live Stripe prices.
3. Complete an authorized real signup, confirmation email, login, trial/cancellation, and provider connection test. Browser checks do not create accounts, buy subscriptions, or authorize OAuth connections.
4. Operator/legal review of Privacy and Terms before relying on these as complete legal documents, including legal identity, applicable jurisdiction, provider contracts, actual retention operations, and response procedures. This refactor is a code-backed factual update, not a legal compliance certification.
5. Physical iPhone keyboard and assistive-technology testing remain manual. No WCAG certification claimed.

Legal drafting guardrails: [FTC privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy) emphasizes honoring actual privacy promises; [Stripe trial documentation](https://docs.stripe.com/billing/subscriptions/trials) describes configuration-dependent trial behavior. Product-specific statements above come from Opryn's implementation, not inferred platform defaults.

Previous production rollback target before this pass: `handoff-9t0xvgrpk-nikitas-projects-acfaddb7.vercel.app`.
