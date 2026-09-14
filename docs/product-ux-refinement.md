# Authenticated product refinement — 8 September 2026

Implemented in the existing application. This is not a public-site redesign or a replacement integration/knowledge system. Existing uncommitted work was preserved. This pass is not deployed.

## Main usability changes

| Before                                                                            | This pass                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dark navigation, competing learning-source entries, no visible business switcher  | Light task-based owner navigation; secondary Connections/Settings; verified business switching. Calls and sources remain accessible from Teach.                                                                                                        |
| Employee learning URL redirected back to Knowledge                                | My Learning opens assigned, accessible approved processes. Owners manage assignments under Team → Learning. Completion failures no longer appear successful.                                                                                           |
| Question suggestions inferred from an industry/role; input below the empty state  | Input first, non-rotating suggestions from accessible approved processes, retained questions on failure, direct error messages, one-click Not Right feedback.                                                                                          |
| Long proposals overflowed cards or appeared in desktop-positioned mobile overlays | Short proposals use inline Accept/Deny. Long proposals open a full mobile review sheet; native dialog focus handling and one scrolling review body.                                                                                                    |
| Proposal acceptance could race another edit                                       | Required proposal revision and timestamp, plus an atomic database decision with authority revalidation, audit, embedding, version and status changes. Updates show current/suggested content.                                                          |
| Successful decisions moved the next button under the pointer                      | Completed rows retain their footprint until cleared intentionally; pending counts update immediately.                                                                                                                                                  |
| Knowledge favored process cards and hid standalone guidance in secondary views    | One-column process list, separate type/status filters, approved rules/answers from the shared store, prominent existing Needs Approval section. Source/history controls remain available.                                                              |
| Integration search duplicated results in a dropdown and the list below            | One visible result set while searching; keyboard-addressable results and accessible connection actions. AI authorization is distinguished from a tested connection.                                                                                    |
| Credential-only providers appeared to be fully working connections                | New connection browsing/recommendations exclude credential-storage-only providers. Existing saved details remain manageable as Setup saved / Not verified. Drive uses the real document-link/upload flow; Teams retains its native authorization flow. |
| Estimated time returned counted every answered request                            | Conservative team-question basis; owner/admin tests, AI-origin requests, escalations, failed/negative answers and exact repeats are excluded. The calculation is inspectable.                                                                          |
| AI process approval could fail while updating worker-owned job records            | The shared process approval service finalizes its organization-scoped learning job using the server-owned client.                                                                                                                                      |

The existing warm-neutral theme, Opryn logo, primary accent, source-first learning, explicit conversation-sharing, approval records, retrieval engine and provider catalog remain in use. Next.js/React guidance informed server-side data boundaries, role-aware navigation, component state synchronization and reusable lightweight dialogs. No animation, model-provider or production client dependency was added.

## Important implementation boundaries

- `DialogSurface` uses the browser top layer, keyboard focus containment/restoration and VisualViewport dimensions. Review, connection/request/credential, navigation/search and notification surfaces reuse it. This fixes the transformed-ancestor/fixed-sheet problem without replacing the app shell.
- Settings saves and failed Ask/feedback/completion operations retain entered work and provide retry feedback. This does not assert that every older network operation throughout Opryn has been rewritten.
- `approveKnowledgeProposal` / `rejectKnowledgeProposal` remain shared by Web and MCP. Their decision is now committed by `decide_knowledge_proposal`. Sensitive operations do not trust a browser-supplied organization.
- A proposal update requires the current knowledge version shown in the review. Embeddings are prepared before the transaction; an embedding failure does not publish a proposal. The transaction also fails closed if a conflict or stale revision is found.
- Proposals associated with multiple process access groups require individual access review instead of accidentally becoming workspace-wide knowledge. Existing multi-role process publication deserves a separate access-model audit; it is not claimed verified by this pass.
- Whole-process editing/publication retains its existing multi-request architecture. Exact-revision atomicity added here covers **proposal decisions**, not every concurrent change to every process step. That broader concurrency hardening remains follow-up work.
- ChatGPT/Claude setup paths were not guessed or rewritten. Conversation learning remains explicit sharing, not historical-account access. Native client buttons are not claimed; MCP uses the existing supported tools and review links.
- The catalog audit found that the generic credential service saves/encrypts details but does not implement the advertised imports or CRM capabilities. Those entries are not promoted as new ready-to-use connections. Existing records and developer management remain available; they are not deleted or silently revoked. Native authorization, AI access, and the actual Drive import flow are retained. Production provider authorization and capability testing remain separate release checks.

## Checks run

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `node scripts/verify-product-workflows.mjs`: conservative estimates, non-merging of different monetary thresholds, route ownership, proposal API required revision, CSRF, role gate, server-selected organization and stale-response behavior. Identity and service calls are explicit mocks.
- `node scripts/verify-setup-checklist.mjs`: 16 source-neutral activation/checklist cases, including optional invites and no required Slack/Drive.
- `node scripts/verify-company-memory.mjs`: freshness/trust guards and review API behavior.
- `node scripts/verify-process-approval.mjs`: actual process approval helper with explicit database doubles; privileged job finalization stays organization/process-scoped; rejected authority and embedding failure.
- `scripts/verify-proposal-decisions.mjs`: executes the new SQL migration in isolated PostgreSQL/PGlite. Tests stale revisions, concurrent calls, replay rejection, role/organization checks, single-role source restriction, denial/answer-only audit, version preservation, conflicts, transaction rollback on audit failure, anonymous grants and rate limiting.
- `scripts/verify-company-memory-sql.mjs`: isolated PostgreSQL trust, conflict, version, confirmation and active-expert routing checks.
- `scripts/verify-product-ui.mjs`: actual React components in an isolated browser harness, **not an authenticated workspace**. Captures phone/tablet/desktop layouts at 320, 375, 390, 430, 768 and 1280px; checks overflow, immediately visible question input, scrollable long review, focus trap/restore, stale-error retention, real-catalog search, truthful authorization labels, failure recovery, source-first selection, prefilled business name, saved-request restoration, keyboard step reordering, approval result replacing the editor, and reduced motion.
- Local production server: MCP discovery, S256 PKCE metadata, unauthenticated challenge and unsafe redirect rejection via `scripts/verify-mcp.mjs`.

The SQL fixture substitutes `real[]` for the embedding vector type: it proves transaction/control-flow behavior, **not pgvector indexing or production Supabase RLS**. The browser harness stubs API responses and routing; its screenshots do not prove provider OAuth, answer quality or live end-to-end activation.

## Requested workflow verification status

| Workflow                                                  | Evidence / remaining check                                                                                                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner teaches → reviews → accepts → gets sourced answer   | Component selection/review/result and isolated approval tested; live ingestion, embeddings and sourced Ask require a test owner workspace.                                                   |
| Unknown question reaches the right expert                 | Existing routing/trust regression tests and isolated SQL passed; live employee-to-expert delivery unverified.                                                                                |
| Owner accepts completed proposal without retyping         | Real component interaction and revision-bearing request tested; atomic decision tested in isolated SQL. Live authenticated round trip pending.                                               |
| Notification opens exact editable item on mobile          | Entity-link click opens the precise review sheet in the browser harness even when mark-as-read fails. Exact URLs and query-driven selection preserved. Live signed-in click-through pending. |
| Employee finds assigned learning and asks about it        | Restored server route and approved/access-scoped queries; completion error recovery tested. Live owner assignment / employee session test pending.                                           |
| Search, connect and truthfully display integration status | Real catalog search and guide tested; real provider authorization/test requires provider accounts and production configuration.                                                              |
| External AI cannot retrieve restricted knowledge          | Shared trust regressions and isolated permission checks passed; a real scoped OAuth/API credential is required for end-to-end proof.                                                         |
| Reviewers cannot accept stale proposal content            | Required revision/timestamp, transaction locking and conflicting-call tests passed in PostgreSQL. Full process-editor concurrency is a separate remaining issue.                             |
| Keyboard and reduced-motion core flows                    | Browser focus/escape/restore, control activation and reduced-motion checks passed. Full WCAG 2.2 AA audit is not claimed.                                                                    |

## Screenshots

All captures use clearly labeled **Example workspace** fixtures and actual product components. Directory: `artifacts/product-ux/`.

- `needs-1280.png`, `needs-768.png`, `needs-390.png`
- `ask-1280.png`, `ask-768.png`, `ask-390.png`
- `integrations-1280.png`, `integrations-768.png`, `integrations-390.png`
- `process-1280.png`, `process-768.png`, `process-390.png`
- `welcome-1280.png`, `welcome-768.png`, `welcome-390.png`
- `sources-1280.png`, `sources-768.png`, `sources-390.png`
- `review-sheet-390.png`, `integration-sheet-390.png`
- `learning-request-390.png`, `process-accepted-390.png`
- `notification-review-390.png`
- `overflow-process-320.png` is the captured **pre-fix failure**, retained as audit evidence, not the intended final layout.

## Before release

1. Apply `supabase/migrations/20260909001000_proposal_revision_decisions.sql` in a staging database matching production, then verify with the real vector extension and existing RLS policies. This migration has **not** been applied to production in this turn.
2. Exercise owner and employee sessions in a dedicated test organization; this session had no available authenticated test login/server service credentials. Do not substitute screenshots for these checks.
3. Test a real ChatGPT/Claude authorized conversation and one native integration; verify allowed versus restricted knowledge. Refresh cached MCP tool definitions so decisions include the proposal revision/timestamp.
4. On an actual iPhone, test keyboard open/close, focused textarea scrolling, safe areas, OAuth/app switching and restoration of saved onboarding state. Viewport emulation is not a device keyboard test.
5. Verify whole-process concurrent editing, multi-role publication, and partial publication recovery before making broader transactional/authorization guarantees.
6. Deploy the code after the migration and live verification. No Vercel deployment or production database mutation was performed for this refinement pass.

Re-run isolated tools by pointing `OPRYN_PGLITE_MODULE` and `OPRYN_ESBUILD_MODULE` to temporary installations. They are intentionally not application dependencies.
