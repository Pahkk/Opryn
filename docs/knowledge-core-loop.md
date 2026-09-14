# Teach → Review → Knowledge → Use

## What changed

- Teach starts with source rows: explain, files, Google Workspace, and selected calls. Existing capture, upload, call, and approval implementations remain in use.
- `ConnectionAction` resolves the active organization’s Google knowledge-import capability. Connected accounts open Picker without navigation. Disconnected accounts open the existing Opryn/Nango sheet; server-confirmed authorization resumes Picker. A per-organization session-storage intent (path only, no credentials) resumes after reload.
- Picker is fixed to the viewport and temporarily releases an enclosing native dialog’s top layer. Selection/cancellation restores the sheet and focus. Instances are disposed and credential requests have a timeout.
- Connections groups providers by their existing capabilities into Teach and Use. A dual-purpose provider appears once, normally in Use, and is labelled “Teach & use Opryn.” Request-only providers remain request-only. No integration capability was invented.
- Knowledge is a paginated library over existing processes, knowledge chunks, and proposals. The overview contains categories, recent entries, review entries, and usage-backed entries. It is not a second knowledge store.
- Search combines title/content/category/tags/source text with the existing semantic matching RPC. Existing organization and role filtering remains authoritative. Category/status/source/date filters use database queries, not filtering an arbitrary first page in the browser.
- Desktop has category navigation and a detail drawer; mobile has a category sheet and filter sheet. Process review loads on demand inside the drawer and uses the existing save/approve endpoints. Proposal acceptance/denial uses the same revision-checked endpoints as Needs You. Complex conflicts and historical knowledge reviews retain their canonical review/history routes.
- Ask-source deep links can open a library item. Teach clarification links and review completion links retain the core loop.

## Taxonomy and smart views

Categories: policy, process, faq, pricing, product_service, sales, customer_support, training, responsibility, decision, exception, definition, uncategorized.

Smart views: Needs Review, Recently Updated (7 days), Most Used, Conflicts, Uncategorized, Potentially Outdated. Freshness mirrors the current health rules: changed source, explicit review, or 90/180-day confirmation threshold for critical/normal knowledge.

New extraction uses conservative title classification; uncertain or conflicting signals stay uncategorized. Existing proposal types are reused when explicit. Reviewers can change category and tags, including during process review. Approval copies proposal classification onto the existing approved record.

## Database and release order

Migration: `supabase/migrations/20260912010000_knowledge_library.sql`.

It adds category, tags and an optimistic metadata revision to the existing three entities; adds archive timestamps; creates security-invoker library/search views, facets, classification propagation, and an atomic archive operation. Existing table RLS still controls access. No provider token storage or new approval collection is introduced.

Historical content, provenance, tags, statuses and roles are not rewritten. New category fields default to Uncategorized. Known FAQ/rule/role source types have a display fallback. Reviewers can classify historical items explicitly.

Archiving keeps source files and original records. A process archive withdraws its associated answer chunks/rules and pending proposals together, avoiding an approved summary continuing to serve an archived rule. A process-derived item therefore offers “Archive related process” with confirmation. Archived records cannot be reapproved silently. There is no self-service restore UI in this pass.

**Released on 12 September 2026.** Migration `20260912010000` was applied and production promoted to `handoff-bu72mjruz-nikitas-projects-acfaddb7.vercel.app`. Schema and public/authentication boundary checks passed; actual Google consent and ingestion still require a real-account task check. Future migrations must be validated before applying, and schema-dependent application code must not be promoted ahead of its migration.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `node scripts/verify-knowledge-library.mjs`: isolated PostgreSQL migration, RLS scope, facets/search, classification propagation, archive and guards; real route handlers with explicit identity/database doubles for auth, origin, revisions and tenant selection.
- `node scripts/verify-nango.mjs`: existing Nango migration, lifecycle, webhook, ownership and API tests.
- Existing process-approval, proposal-decision, product-workflow and learning-file checks.
- `scripts/verify-product-ui.mjs`: real components with explicit API/Google/Nango doubles. Widths 320, 375, 390, 430, 768, 1280, 1440. Includes connected Teach → Picker → import → review link; disconnected Teach → OAuth confirmation → Picker; reload resume; category/filter/detail sheets and classification.
- Screenshots in `artifacts/product-ux/`: `knowledge-*`, `knowledge-detail-*`, `knowledge-categories-*`, `knowledge-filters-*`, `teach-google-*`, `teach-google-selected-*`, `integrations-*`.

The browser fixtures are not live Google consent/Picker evidence, real company data, or real AI ingestion. Actual Google iframe behavior, Safari/iOS, live semantic retrieval and production database policies need a staging account check before release. No new Google/Nango/Vercel environment variables are required.
