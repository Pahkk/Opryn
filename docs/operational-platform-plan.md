# Operational platform implementation plan

## Repository audit

Next.js App Router / React 19, Supabase tenant-scoped data and RLS, existing OpenAI services, Motion product transitions and GSAP marketing storytelling. No new animation or integration framework is needed.

Existing authoritative stores: knowledge_chunks (approval, health, version, role), knowledge_versions, knowledge_proposals (exact-revision atomic decisions), processes/rules, question_clusters (semantic grouping at 0.84), employee_questions (channel, conversation, expert), question_answers, question_sources, knowledge_experts and knowledge_events. Needs You aggregates decisions rather than maintaining another inbox.

Existing integration boundaries: Nango authenticates; content-providers/source-import normalize selected Google, Notion and Confluence sources into reviewable processes. Communication answer service serves Slack/Teams. External AI API and MCP use permission-scoped retrieval and the shared trust gate. Source checking, conflicts, freshness, role training assignments, notifications and Guide's controlled registry already exist.

Confirmed defect: questions/resolve reports awaitingApproval but creates no proposal. Existing answer edits also do not update the stored human answer. One-time exception intent is not explicit in this workflow. Unknowns are clustered but escalation is currently opt-in for employee/communication surfaces. External API unknowns and escalations use a different interaction record; consolidate carefully, without duplicating counts or bypassing caller access.

## Ordered implementation gates

1. Extend existing question/cluster records into the gap lifecycle. Repair human-answer → proposal handoff atomically, preserve expert/approver separation and one-time intent. Verify permission, retry, exception, notification and tenant behavior in isolated PostgreSQL before expanding the feature set.
2. Add a shared validated optional scope model and enforce it across every retrieval surface. Build Test Opryn on the real retrieval/answer service, with saved expected outcomes and simulations clearly distinguished from external delivery.
3. Extend current source checks and conflicts; use existing immutable versions. Link affected tests, retrieval events, relationships and permitted AI connections into change impact. Do not invent retrieval histories.
4. Extend existing external connection policies and training assignments. Permissions must be enforced in SQL/server code, not prompts; learning completion is viewed/acknowledged/practiced, never mastery.
5. Derive owner intelligence and selected-source analysis from real events/issues. All analysis findings must link to Teach, Needs You, Knowledge or tests.

Each gate requires automated database/security tests, rendered desktop/mobile verification, lint/typecheck/build and an explicit status report. Do not start five unfinished dashboards. Do not deploy or apply migrations to production without approval for this project.

## Migration/rollback policy

Use additive migrations. Retain existing source and version records. Rollback application code before removing new fields/functions; retain proposals already created and their audit provenance. Never discard customer knowledge to roll back UI.
