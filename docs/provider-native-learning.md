# Provider-native conversation handoff

Worker safety: extraction claims the job using its database `updated_at` revision. A concurrent loser exits before model calls or proposal writes; fresh processing jobs are not restarted. Abandoned processing can be retried after fifteen minutes. The existing database timestamp trigger supplies the revision change. The isolated worker regression checks that active/lost claims do not invoke the model.

## Implementation

Audited active ConversationLearning, saved session/status routes, registered MCP tool, authenticated worker, canonical process/proposal review and Guide context. Existing icons, provider logo code and artwork are unchanged. Billing, learning permissions and approval authority remain unchanged. No new integration framework.

Both connected provider rows now sit under “Already taught ChatGPT or Claude about your business?”. The user chooses business/process/topic/general, confirms a name, opens the provider's web surface and sends one prepared instruction in the existing conversation they choose. Normal copy contains no protocol setup terms. Instructions use “Use Opryn to…” rather than assume a universally available @Opryn invocation. Enabling Opryn and accepting the provider transmission remain user actions; opening the provider does not execute a prompt or select a private chat.

The server issues a random UUID handoff reference with a 30-minute expiry inside the existing organization/user onboarding session. Client-supplied references, expiry and attached job IDs are not trusted. References are not credentials; an authorized provider grant with learning permission is still required. Requests are saved before opening the provider, and closing/reloading resumes them.

`learn_from_context` accepts `learning_request_id` and `general`, validates the authenticated pending session's provider/expiry, preserves its user-selected name/type and links the standard external learning job before extraction. General normalizes to the existing canonical topic storage mode, preserving historical constraints. Provider attribution comes from authenticated client kind, not caller-supplied provider metadata. Wrong/expired references reject rather than associate another workspace. Retry responses include a duplicate flag. Already-approved duplicate content retains its approved record and follows the existing Try path.

Polling uses linked job ID when the reference arrives. Without it, a recent submission from the same authenticated workspace/user/provider becomes a candidate: “Is this the conversation you just sent?” Explicit confirmation is required before showing its processing/findings as the onboarding result. It is re-confirmed after refresh rather than silently persisting an uncertain association. “I sent it” triggers an immediate check, not a fake receipt.

States: Waiting for provider → Conversation received → actual worker processing → actual findings → canonical review/approval → Try Opryn. Only real positive extraction counts are displayed. Processing may skip short-lived stages; completed results are never delayed to display an animation.

Orb states: received has no orb, reading/weaving, extracting/searching, preparing review/composing. Waiting with no verified job does not imply real AI work. Motion handles sheet/state transitions through existing primitives, no GSAP or new animation dependency.

Guide receives safe recent learning statuses scoped to the same user/workspace, along with connection capability, and can answer receipt/completion questions. It never reads private provider history or controls external interfaces. Existing authorized Opryn highlight targets remain; copy/open/help actions are available in the native handoff sheet. Dedicated external Open/Copy Guide-panel tools and new spotlight choreography are not implemented.

## Migration and release prerequisites

**Required for correlated jobs:** review and apply `supabase/migrations/20260916070000_onboarding_learning_requests.sql` to a nonproduction database first. It adds the optional `learning_request_id` job column and a partial organization/user/request unique index. The index prevents concurrent inserts for one reference. Same-content retry returns the existing job; different-content reuse is rejected. Legacy null-reference jobs remain valid. Rollback is documented in the migration; stop correlated handoffs before removing the column/index, retaining existing jobs and approved knowledge.

No migration has been applied to production. No new environment variables, secrets or provider grants were created. This change is not deployed.

Provider setup depends on an eligible account/workspace and enabled Opryn tools. Existing native setup sheets resume the original task. [Official ChatGPT setup](https://developers.openai.com/plugins/deploy/connect-chatgpt) and [official Claude connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) were checked; no prompt-prefill/execution deep link is assumed. Mobile explicitly offers provider web or another source if Opryn is unavailable in the native app. An OAuth grant does not reveal the user's current plan/UI availability.

## Privacy and analytics

Only explicitly submitted context enters the existing learning worker. Status/Guide queries do not select raw context, tokens, provider secrets or raw errors. Standard source provenance, content retention and eventual raw-job-context clearing remain unchanged. Human approval determines authority.

Uses existing event types with metadata metrics: handoff created, provider opened, instruction copied, context received and review started. Worker event types already capture processing start/completion. No conversation text in analytics. Dedicated idempotent `learning_first_approved` telemetry is not added; actual publication/version events remain authoritative.

## Tests and limitations

- `verify-conversation-onboarding.mjs`: actual React UI, isolated mocked services, 1440 ChatGPT/768 Claude/390 reduced-motion ChatGPT; generated reference, popup fallback, saved resume, automatic statuses and explicit Claude candidate confirmation. Screenshots in `artifacts/conversation-onboarding/`.
- `verify-conversation-status.mjs`: actual routes with auth/database doubles; tenant/provider/user/name/time filters, bad requests/auth/origin, server-issued reference/expiry and rejection of client-attached job IDs.
- `verify-learning-handoff.mjs`: actual handoff validator with explicit database doubles plus isolated PostgreSQL additive migration repeatability, request uniqueness and compatibility with null legacy references.
- `verify-guide-server.mjs`: Guide security/validation regression with explicit service doubles.

These are not live provider OAuth, a real extraction model, or full authenticated database E2E. Test both providers in a dedicated nonproduction workspace after applying the migration: send context with/without reference, confirm candidates, retry simultaneous requests, revoke/read-only grants, approve an actual finding and ask a sourced question.

Existing hash/proposal checks and overlapping numeric conflict safeguards are reused. Full semantic duplicate review with Update existing/Keep separate/Dismiss actions and comprehensive nonnumeric conflict detection remain unfinished; do not claim otherwise. No separate provider knowledge store or automatic policy overwrite.
