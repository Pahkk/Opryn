# Premium conversation learning

## Entitlement and provider eligibility

`ai_conversation_learning` is defined centrally in `lib/billing/plans.ts`. An active/trialing Stripe-backed Premium entitlement is required by the MCP tool, legacy context-write aliases, and onboarding handoff creation. OAuth `opryn.learning.create` consent and owner/admin permission are separate requirements. Provider availability is independently configured in `lib/onboarding/provider-capabilities.ts`; OAuth connection is not proof of provider write capability. Unsupported users can use another source rather than upgrading their external provider account.

## Tool and jobs

MCP server version 1.1.0 advertises `learn_from_context` schema version 1: required learning_type (business/process/topic/general), name, context; optional focus, source_title, provider, learning_request_id. Required fields remain backwards compatible. Context limit: 100,000 characters. Workspace and provider derive from authenticated OAuth; conflicting supplied provider is rejected. The tool returns a concise receipt and creates a durable job. Next.js after() starts processing; the existing cron recovers interruptions. Atomic job claims, request uniqueness, and existing proposal extraction/dedupe/conflict handling are reused. Nothing is approved automatically. Complex semantic duplicates/conflicts are not guaranteed by simple matching.

## Onboarding and billing

Reuse the organization/user-scoped learning session with opaque UUID, provider/type/name, 30-minute expiry and linked job. Scoped polling resumes onboarding on receipt, then shows real processing/findings and existing review/activation. Ambiguous uncorrelated jobs require confirmation. Non-Premium users open an inline plan chooser. The onboarding_ai_learning checkout source validates a saved intent, preserves configured Stripe prices/trial eligibility, and returns through canonical billing return. Webhook-verified entitlement is required to resume; unlocking does not complete onboarding. Existing Core subscriptions use the billing portal: configure it to permit the Premium price upgrade.

## Privacy and migration

Only explicitly sent context is processed, with existing retention behavior. No provider-history access, remote prompt execution, profile collection, auto-publication, or raw conversation analytics. Migration 20260916071000_ai_learning_workspace_limits.sql is additive and must be reviewed/applied before release. Its service-role-only RPC permits five workspace attempts/minute and 25/hour across grants; existing per-grant limits also apply. Missing RPC fails closed. Rollback: stop submissions before removing function/table. No production migration or deployment was performed for this change.

## Provider refresh after release

The signed-in ChatGPT Opryn connector was inspected: OAuth and https://www.opryn.app/api/mcp were configured, but the cached action list had only five older tools, without learning. After deployment, open Opryn in ChatGPT Plugins → Refresh, confirm learn_from_context, then start a new conversation with Opryn enabled. Developer installations support this refresh; published installations require the applicable app-update/review process. See [official ChatGPT instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt). Refresh does not grant an unsupported external account write capability.

For Claude, check Customize → Connectors, authenticate Opryn and enable it in the intended conversation. Verify the tool is present; reconnect through supported connector management if stale. Managed organizations may require an owner. See [official Claude instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). No slash command or auto-executing deep link is assumed.

## Verification and remaining release gate

Run scripts/verify-premium-learning.mjs, verify-premium-learning-sql.mjs, verify-conversation-status.mjs and existing conversation UI/activation checks. SQL uses isolated PGlite via OPRYN_PGLITE_MODULE, never linked Supabase. MCP transport tests use the real SDK with explicit service/model doubles. A refreshed provider, dedicated Premium test workspace, Stripe test upgrade, and actual extraction/review/approval invocation are still required before claiming live end-to-end verification.
