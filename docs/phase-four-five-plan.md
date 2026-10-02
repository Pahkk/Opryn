# Phase 4/5 implementation plan

Audit: Next 16 App Router/React 19, existing direct OpenAI services, Supabase RLS, Nango source importer, external AI match RPC/scopes/category access, Test Opryn, training_assignments/process roles, Knowledge Health/gap clusters, owner dashboard and conservative returned-time calculation.

1. Phase 4: additive connection policy (existing categories as subjects, selected items, exclusions), transactional permission-checked updates, server retrieval enforcement, unknown-routing preference and minimal item/version lookup attribution. Reuse Test Opryn and connection detail.
2. Phase 4: reuse process assignments and role access; additive honest learning state/version acknowledgement, role assignments, approved-source practice with explicit self-comparison rather than a fabricated mastery judge. Reuse My Learning and Team Learning, no rankings/surveillance.
3. Phase 5: org-scoped aggregated activity/ROI and a single evidence-led Teach Next recommendation across gaps/conflicts/freshness. Company analysis uses explicitly selected supported sources through the actual importer/extractor; aggregates real workspace findings and routes each issue to review/Needs You/Teach. No automatic approval or all-tenant ingestion.
4. Verify permission/org isolation, exact item policies and retirement/version behavior, learning and analysis failure/retry paths using isolated actual SQL/service/component fixtures. Build/typecheck/lint. Production rollout only after rollback-only actual-schema migration validation, candidate build, then migrations and promotion. Preserve current icons and prior deployment.

Constraints: no new pricing/entitlements/provider framework, no fabricated savings, no private provider identities, no live model/provider calls or synthetic customer records during production smoke. Disclose nonproduction authenticated/provider E2E limitations.
