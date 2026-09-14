# Company memory: priority implementation

Opryn remains one knowledge system. This change extends the existing chunks,
versions, conflicts, expert assignments, question clusters, events, and reviews.
It does not create channel-specific knowledge or a second approval database.

## Delivered in this pass

- `/app/knowledge/health`: real recorded coverage, unresolved question clusters,
  conflicts, overdue confirmation, single-assigned-expert areas, and source usage.
- `/app/knowledge/[id]/history`: current content, retained versions, and explicit
  confirmation history. Owner/admin only; historical content is read-only.
- `/app/knowledge/week`: rolling seven-day report from real events, human
  escalations compared with the preceding seven days, and a Teach Next action.
- Home and Knowledge link to these views. Needs Approval still precedes Health.
- Needs You includes age-based reviews and source-modification timestamps already
  recorded in Opryn. Assigned experts can open their question's review screen.
- Web, Slack/Teams, MCP, and external API retrieval use the same fail-closed
  trust gate after their existing permission-scoped retrieval.
- The existing process/proposal approval services reject unresolved conflicts
  attached to the knowledge being updated; reapproval cannot simply clear them.
- Web, Slack/Teams, and MCP use the same active-member expert lookup. A matched
  knowledge assignment takes priority over category matching. No match preserves
  the existing owner fallback. Category matching is deterministic token matching,
  not a new semantic model or inferred expertise.
- Confirmation and conflict review are transactional PostgreSQL operations with
  admin authorization, organization checks, audit records, version/replay checks,
  and a 60-actions/minute reviewer limit. The web route also rejects cross-origin
  requests. A confirmation cannot clear a conflict or promote unapproved content.

## Transparent definitions

No AI score is calculated or shown.

- Critical knowledge: confirmation due after 90 days.
- Other knowledge: confirmation due after 180 days.
- Recorded source modification after confirmation: review due.
- `needs_review`: explicit review request; it is not authoritative answer context.
- `conflict`: no answer from that retrieval context until resolved. The gate checks
  both health flags and open conflict records, including conflicts whose other
  document the employee cannot read. Only a boolean leaves the database.
- Healthy coverage: approved recorded entries with no recorded conflicts or due
  reviews. This does **not** certify that an area is complete.
- Single-expert risk: exactly one current member assigned to a recorded area. It
  does **not** infer employees' private knowledge or monitor their performance.
- Teach Next: existing open semantic clusters with unresolved questions in the
  last 30 days, ordered by unresolved count, actual escalations, people, recency.
  Estimated interruption time uses actual escalations × the organization's
  existing configurable interruption estimate. Unknown alone is not an escalation.
- Time returned: Opryn-handled Web/communication/MCP questions × that same
  estimate. External API requests are reported separately, not converted to human
  time automatically. Human escalations include experts, not only owners.
- Health counts searchable knowledge entries, not an invented count of whole
  processes. Reads paginate in batches of 500, with a 5,000-record dataset bound
  and a visible partial-data warning. Weekly count queries are exact.

## Conflict resolution behavior

Choosing a source withdraws the losing chunk without deleting its audit/version
history. If it belongs to a process, that process and its indexed chunks require
review: a summary must not remain searchable with the same withdrawn rule.
The selected record is not automatically promoted from Observed to Approved.
Another open conflict remains blocking. `Keep Both` is only allowed for possible
duplicates, not genuinely contradictory policy. Editing/reapproval uses the
existing process/proposal workflow, not a historical-version overwrite endpoint.

## Rollout — required before deploying application code

Apply `20260908001000_company_memory_reviews.sql` to the intended staging database,
then production through the project's normal migration workflow. Deploying the
new application before its RPCs exist will intentionally fail closed on retrieval.
Production rollout completed September 8, 2026: migration applied to the linked
database, followed by deployment `dpl_DXpHjFs6Bcnv7Lx6Tnfs5d29a9eh`, aliased to
`https://www.opryn.app`. The production build passed. HTTP smoke checks verified
the homepage/login, sign-in redirects for the protected memory pages, OAuth
discovery, and MCP's unauthenticated 401 response. The trust RPC rejects anonymous
access. No error logs were returned in the immediate post-deployment scan.
Authenticated cross-client end-to-end verification remains outstanding.

The migration is additive: indexes and security-definer functions with explicit
grants. It does not alter company policy rows during migration. The new review
functions use the existing `is_org_admin` / `is_org_member` helpers. Verify them
with real signed-in owner and employee sessions before release.

## Verification

```
npm run typecheck
npm run lint
npm run build
node scripts/verify-company-memory.mjs
node scripts/verify-setup-checklist.mjs
node scripts/verify-company-memory-ui.mjs
```

The UI check renders the real Health page with explicit fixture data, using built
CSS at 320/375/390/430/1280px. It tests overflow, anchor navigation, reduced motion,
and the new-workspace state. It is not an authenticated production browser test.

An optional isolated PostgreSQL test requires PGlite installed outside the app:

```
OPRYN_PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js \
  node scripts/verify-company-memory-sql.mjs
```

It executes the actual migration against a minimal fixture schema and verifies
organization/role isolation, restricted-source handling, version mismatch,
conflict resolution, remaining conflicts, retained history, replay rejection,
active expert routing, function grants, and write-rate limiting. No live company
data or credentials are used. This does not replace testing against the full
Supabase schema/RLS configuration.

Existing `verify-process-approval.mjs` has a stale assertion expecting
`setApproved(true); router.replace(returnTo)` adjacency; the current editor uses
an approval success screen. That unrelated editor was not changed in this pass.

## Deliberately not claimed as complete

- Continuous Drive/source polling, source-content snapshots/hash comparison,
  durable source-change jobs and import-diff review. The existing Drive flow
  imports selected shared URLs; it is not full-workspace automatic monitoring.
- New semantic conflict extraction for every ingestion path. Existing detection
  remains; this pass strengthens handling of recorded conflicts.
- Consolidating legacy external-API escalation records with employee questions,
  external-API expert routing, or attributing all API questions to gap rankings.
- Monthly knowledge-growth snapshots, a complete activation/retention event
  pipeline, scheduled report email delivery, or advanced health billing tiers.
- Historical-version restore UI, new process relationship editing, or controlled
  external actions. Existing guided checklists and versioned approval stay intact.
- Live cross-client OAuth/answer/approval testing against the deployed app.

These are follow-on work, not simulated activity, guessed policies, or finished
features hidden behind an attractive UI.
