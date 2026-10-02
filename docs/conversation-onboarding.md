# ChatGPT and Claude onboarding learning

This records the initial implementation. The subsequent request-correlation changes and required additive migration are documented in [Provider-native handoff upgrade](provider-native-learning.md), which supersedes the name-only matching, @mention and no-schema-change details below.

## Audit and implementation plan

Inspected the live onboarding route implementation, ActivationOnboarding, the legacy GuidedOnboarding/SourceFirstLearning screens, TeachWorkspace, ConnectionGuide, provider logos, onboarding learning-session/status routes, registered `learn_from_context` tool, external learning worker, canonical process approval, proposal duplicate/numeric-conflict checks, Guide context/registry, and the existing event constraints. The active owner route uses ActivationOnboarding; the older conversation flow was not mounted there. No live authenticated onboarding or real provider authorization was exercised.

Plan: reuse the existing OAuth grants/jobs and saved intents; add conversation-source rows to the active Teach stage; guide setup in the existing accessible dialog; prepare scoped current-conversation requests; poll matching jobs; hand off to canonical onboarding review/approval/answer/billing; verify isolated UI/routes and production compilation. No new integration framework or database schema.

## User flow

Company Setup remains one screen. Teach now says “Start with what your business already knows.” ChatGPT and Claude appear alongside existing Google Workspace, upload and explanation workflows. Existing Notion/Confluence sources remain available.

Each conversation source uses the existing provider symbol, verified Connected/Needs setup status, Connect/Finish setup/Learn action and canonical Manage link. Setup stays in an Opryn-native, focus-trapped dialog; after confirmed learning permission it resumes learning. Choose My business, A process, A topic or Something else (a topic with an editable name). Business name is prefilled from the confirmed Company Profile. No unsupported evidence-based recommendation is manufactured.

Opryn prepares a natural-language request for its registered `learn_from_context` tool. ChatGPT uses the @Opryn selection cue; Claude uses “Use Opryn to…”. No custom `/learn` command is required by the new flow. Both specify the exact editable name and human review. Copy the request, open the **existing** conversation, enable/select Opryn, paste it, and accept the provider's send confirmation. Opening a provider does not send data, select an existing chat, or install a tool automatically. A reliable current-conversation deep link is not configured.

Close preserves the request. Explicit Choose another source clears it. Named requests are durably saved before the provider window navigates; popup/clipboard failure has a normal link and selectable request fallback. Refresh resumes the saved intent. Polling every four seconds is sequential, pauses in hidden pages, aborts on unmount, and filters by authenticated workspace, user, provider, exact name and request timestamp **before** taking the latest job. Unrelated or old jobs cannot activate this flow.

## Provider setup requirements

ChatGPT's current official setup instructions use Settings → Security and login → Developer mode, then Plugins → +. Availability depends on the account and workspace policy. The setup sheet necessarily names the provider's required setting but does not ask users to understand the protocol. A public directory install for Opryn is not configured or verified. [Official OpenAI setup documentation](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Claude individual setup uses Customize → Connectors → + → Add custom connector. Team/Enterprise owners may first need to add it under organization connectors. The user's provider plan/policy must support custom connections. [Official Claude setup documentation](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

The existing secure connection address is `https://www.opryn.app/api/mcp`. No customer token/API key is displayed. Opryn verifies an unrevoked grant belonging to the current user/workspace and requires `opryn.learning.create` for the ready-to-learn state. A previous read-only authorization is not sufficient. A missing setting requires help from the provider/workspace administrator or using upload/explanation instead; no access-control bypass.

## Learning, processing and review

Existing tool → `startExternalLearning` → `external_learning_jobs` → `processExternalLearningJob` → canonical extracted process and `knowledge_proposals`. Existing worker/cron retry infrastructure is preserved. Received displays an honest receipt without an orb; processing/weaving, extracting/searching and organizing/composing display the existing OprynThinkingOrb only for actual worker statuses. No timer-driven percentage/stage invention. Polling may skip short-lived statuses rather than delaying completed work.

Counts display only positive numeric fields actually returned in `result_summary`: processes, rules, FAQs, clarifications. The current extractor generally produces one process plus rules, not an invented collection of policies/definitions. Ready hands the real process ID to ActivationOnboarding's existing `prepared` handler. That loads the actual finding in Review, preserves Edit/Deny/Approve, then continues to Try Opryn and unchanged Stripe-backed plan/trial choices. Ordinary MotionRegion/Button/dialog primitives handle transitions; no new GSAP or animation framework.

Provenance remains ChatGPT/Claude conversation (or a supplied safe title) on the source and proposals. A conversation is not approved authority. Existing exact context/job hashes prevent duplicate event ingestion; proposal content hashes deduplicate exact proposals, and existing overlapping numeric-limit checks flag some conflicts for individual review/Needs You. Approved guidance is never silently replaced.

**Remaining limitation:** broad semantic duplicate grouping with explicit Update existing/Keep separate/Dismiss actions is not newly implemented here. General nonnumeric contradiction detection is not comprehensive. Do not describe the existing hash/numeric checks as full semantic reconciliation. Canonical approval safety still applies.

## Guide

Guide's controlled connection context now includes only each provider's name, safe status and conversation-learning capability, scoped to the current user's unrevoked grants in the current workspace. Employees do not gain integration-management context. Deterministic help explains connection/setup, receipt troubleshooting, finding review and approval separation without claiming it inspected conversation contents or completed a task. Existing authorized Connections/Needs You Show me targets are retained. The inline setup sheet supplies the step-by-step guidance; no cross-provider moving pointer, automatic external install, or new spotlight choreography is claimed.

## Analytics

Uses the existing constrained onboarding event taxonomy, with requested metric names in safe metadata:

- integration_selected → chatgpt_connect_started / claude_connect_started
- integration_connected (confirmed learning-enabled connection) → chatgpt_connected / claude_connected
- external_ai_learn_started → chatgpt_learn_started / claude_learn_started
- external_ai_context_received (server receipt) → chatgpt_learn_received / claude_learn_received
- learning_review_opened → ai_source_review_started

No content in analytics. Existing publication/version events remain authoritative for approvals; a dedicated idempotent `ai_source_first_approval` metric is not added. No event-constraint migration is required. Best-effort telemetry never delays review/connect; analytics tooling must read `metadata.metric` rather than expecting new `event_type` strings.

## Security and unchanged behavior

All new requests send the expected workspace header; `getRequestContext` validates it against authenticated membership, never chooses a workspace from it. Server routes enforce owner/admin access and the existing billing boundary. Pending intent contains only provider/type/name/stage/time, no conversation or credentials. Status never queries/returns raw context or provider tokens/error details. Existing worker clears job context after extraction, while normal source provenance/content retention remains unchanged. This does not promise zero storage of deliberately supplied conversation information. No production migrations, new environment variables, secrets, provider grants or billing changes were made.

## Verification

`scripts/verify-conversation-onboarding.mjs`: actual React components in an isolated HTTP/Playwright fixture; ChatGPT desktop/mobile and Claude tablet, 1440/768/390, connection setup, saved type/name, handoff, popup fallback, resume after closing/reload, real-status UI changes, orb completion, count/provenance display, callback, keyboard/native-dialog handling, reduced motion, no page errors or document/dialog horizontal overflow. Screenshots in `artifacts/conversation-onboarding/`. Explicit mocked provider/job responses: **not live OAuth, real model extraction, or authenticated database E2E**.

`scripts/verify-conversation-status.mjs`: actual route handlers with explicit auth/database doubles; tenant/user/provider/name/time filtering, invalid parameters/intents, no context select, cross-origin and authentication rejection. `verify-guide-server.mjs`: existing Guide security/validation regression. `verify-activation-db.mjs`: isolated PostgreSQL Company Profile/revision/tenant/permission migration regression. No production writes.

The standalone `test:mcp` command requires a running local app and initially failed with connection refused on port 3000; real authenticated MCP/provider testing remains outstanding. Do not run `verify-mcp-authenticated.mjs` against production: it creates test grants using service credentials.

Final local checks: lint, TypeScript and the production build passed. Both new verification scripts passed. The existing activation UI regression passed at 1440/768/390/360px in Chromium and 430px in WebKit, including Explain → review → approval → sourced answer with mocked services. Guide security and isolated PostgreSQL activation regressions passed. These are fixture checks, not real provider authorization or production testing.

Before claiming fully verified provider E2E: use a dedicated nonproduction workspace, add Opryn separately in ChatGPT and Claude, explicitly send selected conversation context, verify receipt/extraction, approve an actual finding, ask a sourced question, retry a duplicate/failed send, and test revoked/read-only grants. Confirm provider eligibility and policies. This pass is not deployed automatically.
