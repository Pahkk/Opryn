# Phase 3 implementation plan

Build on canonical processes, knowledge chunks/versions, Needs You, connected source imports, and saved tests. Do not introduce another knowledge store or deploy/apply migrations to production.

1. Make source observations durable, prevent concurrent imports, preserve the last approved source baseline across multiple pending revisions, and publish process replacements transactionally.
2. Guard conflict decisions with the exact knowledge versions reviewed, preserving scope in history. Keep unresolved conflicts blocked from retrieval; never automatically choose a policy.
3. Add an organization-scoped owner/admin impact view with actual related process knowledge, linked tests, and observed citations. Clearly distinguish available evidence from unsupported analytics.
4. Surface source freshness and pending updates through Knowledge Health and existing Needs You. Make Health and Test Opryn discoverable from Knowledge.
5. Verify isolated database/service behavior and rendered desktop/mobile UI, run typecheck/lint/build, update Graphify, and report adapter/testing limitations explicitly.
