# Opryn deployment configuration

Opryn keeps every OpenAI credential and model setting server-side. Configure
these variables in Vercel for Production, Preview, and Development:

```env
OPENAI_API_KEY=<secret>
OPENAI_TEXT_MODEL=gpt-5.6-luna
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

`OPENAI_TEXT_MODEL` is used for structured process extraction, company Q&A,
reusable owner rules, and starting-plan recommendations.

`OPENAI_TRANSCRIPTION_MODEL` receives audio only. Uploaded video is converted
to a temporary MP3 audio track inside the server function before transcription.
The temporary files are deleted after each request.

`OPENAI_EMBEDDING_MODEL` remains separate because pgvector retrieval requires
embedding vectors rather than generated text.

Never prefix these variables with `NEXT_PUBLIC_`. After changing a production
model variable, redeploy the application so every server function uses the new
configuration.

## Team invitation emails

Opryn sends employee invitations through Supabase Auth magic links. Add these
URLs to Supabase Authentication → URL Configuration → Redirect URLs:

```text
https://www.opryn.app/invite/**
http://localhost:3000/invite/**
```

For reliable production delivery, configure custom SMTP in Supabase. If email
delivery is unavailable or rate limited, Opryn still returns a one-time secure
link that an owner can copy and send manually.

## Stripe billing

Reuse the existing Stripe Products, then create new recurring monthly Prices for
Starter ($49 USD) and Pro ($129 USD). `node scripts/prepare-stripe-prices.mjs
--mode=test` audits first; repeat with `--apply` only after verifying the
account and mode. Repeat separately for live mode when authorized. Never edit
or delete historical Prices or move active subscriptions automatically. Then
configure these server-side Vercel variables:

```env
STRIPE_SECRET_KEY=<secret>
STRIPE_WEBHOOK_SECRET=<secret>
STRIPE_CORE_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_LEGACY_CORE_MONTHLY_PRICE_IDS=price_...
STRIPE_LEGACY_PREMIUM_MONTHLY_PRICE_IDS=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
NEXT_PUBLIC_SITE_URL=https://www.opryn.app
SUPABASE_SERVICE_ROLE_KEY=<secret>
```

Annual checkout stays hidden unless both annual Price IDs are configured:

```env
STRIPE_CORE_ANNUAL_PRICE_ID=price_...
STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...
```

Register `https://www.opryn.app/api/billing/webhook` as a Stripe webhook and
subscribe it to `checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, and `customer.subscription.deleted`.
Subscription access is updated only by verified webhook events; returning from
Checkout does not unlock Pro by itself. Configure the Stripe Customer Portal
for payment methods, invoices, cancellation, and supported plan changes. Its
switchable Prices must use the new Price IDs while preserving grandfathered
subscriptions and existing proration/scheduling behavior. `core` and `premium`
remain internal entitlement/database keys for backwards compatibility; public
plan names are Starter and Pro.

### September 19, 2026 price cutover status

The OprynStripe live account's existing Core/Premium Products were renamed
Starter/Pro and retain their original product IDs, tax category, and internal
`opryn_plan` metadata. Both also have stable public `plan_key` metadata. The
new USD monthly Prices are the product defaults:

| Public plan | Current live Price ID | Grandfathered live Price ID |
| --- | --- | --- |
| Starter | `price_1UHV6RLKrHsM6sKQh5Loq602` ($49) | `price_1U8oY7LKrHsM6sKQzEyE1OsP` ($99) |
| Pro | `price_1UHV6pLKrHsM6sKQZLhPOYqe` ($129) | `price_1U8oY8LKrHsM6sKQLU9vZNZD` ($249) |

The production Vercel current monthly Price ID variables point at the new
Prices. Both legacy monthly ID variables retain the old IDs for webhook mapping.
One active live subscription remains on the grandfathered $249 Pro-equivalent
list Price, with a 100%-off-forever coupon; no subscription was migrated. A
separate test-mode Starter and Pro Product/Price pair was also created. The
production publishable key now matches the live Stripe account. No deployment
was performed, so the currently deployed application has not picked up the
new configuration/code.

The live default Customer Portal configuration now allows self-service plan
switching using only the current Starter and Pro Prices above. Quantity changes
and promotion codes remain disabled. Plan changes apply immediately with
prorated charges or credits invoiced at the update; an active trial continues
when a customer changes plans. Stripe's portal supports scheduling a downgrade
at period end only between Prices on the same Product, while Starter and Pro
are separate Products, so cross-plan downgrades also apply immediately. The
five-day trial is configured in Checkout code; no trial subscription or
existing subscriber was changed as part of this cutover.
