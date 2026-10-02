# Phase 2 implementation plan

Reuse approved knowledge, immutable versions, canonical proposal approval, trust/conflict gates, original-actor retrieval and external connection policies. Do not create a separate knowledge store or answer model.

1. Add a validated optional JSON scope contract (global by default), applicability matching and tenant-safe persistence. Missing required context must fail closed, not select a regional/role-specific rule arbitrarily. Apply scope before model input on employee, communication, MCP, API and recheck paths.
2. Build an owner/admin-only Test Opryn simulation using the real retrieval/answer service and actual member/connection permissions. Report answer/unknown/conflict/clarification/restricted with current source/version/status/access. No synthetic questions, gaps, external sends or ROI events.
3. Add organization-scoped saved tests with explicit deterministic expected outcomes. Persist run evidence; identify linked approved-version changes and offer rerun. No opaque model correctness judge.
4. Add scope visibility/editing in Knowledge/review without rewriting approved history. Link Test Opryn from knowledge detail, health and AI detail; keep it secondary navigation.
5. Run isolated SQL/security and service fixtures, rendered desktop/mobile QA, lint/typecheck/build. Production schema/deployment require new explicit approval.

Risks: context is applicability, not permission. Never let role/channel form values grant access. Connection simulations must use real allowed sources/scopes. Existing conflict rules stay fail-closed. Preserve current icons, billing, integration credentials and homepage.
