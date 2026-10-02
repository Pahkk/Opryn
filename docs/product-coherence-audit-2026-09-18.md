# Opryn product coherence: audit and first implementation slice

## Status and release boundary

This is **not a completed whole-product audit/redesign or a release certification**.
The current pass inspects the core workflow and repairs Ask's return path. It preserves
the existing public site and all prior working features. No deployment or migration
has been performed in this pass. The user authorized deployment **after** implementation
and verification; remaining work below prevents calling the overall request complete.

## Architecture discovered

Next.js App Router, React, Supabase/PostgreSQL with session RLS and narrowly used service
credentials, direct configured OpenAI services, Stripe billing, Nango source connections,
communication adapters, MCP/external-AI access, Motion and the existing Thinking Orb.

| Responsibility | Actual implementation inspected |
| --- | --- |
| Ask and thread context | `app/api/ask/route.ts`, `components/app/ask-opryn.tsx` |
| Approved retrieval, scope, conflicts | `knowledge/trust.ts`, `scoped-context.ts`, `scope-context.ts`, `retrieval.ts` |
| Gap/expert intake | Ask's `record_question_cluster`, `employee_questions`, `knowledge/experts.ts` |
| Human answer versus reusable proposal | `api/questions/[id]/answer`, `knowledge/proposals.ts`, human-answer migration |
| Approval and original-question verification | proposal decision transactions, `gap-rechecks.ts`, `external-gap-rechecks.ts`, recheck migration |
| Decision inbox | `lib/opryn/needs-you.ts`: questions, proposals, processes, conflicts, freshness, feedback, rechecks, integrations |
| Source lineage and change protection | source-freshness/import pipeline; existing Phase 3 services and regression suite |
| Workspace identity | `lib/app-context.ts`: organization name and signed logo URL already exist |
| Onboarding | activation state, real approved-answer activation recorded by Ask |
| Guide | authored `guide/registry.ts` targets, not arbitrary model-generated selectors |
| Upload and voice capabilities | `learning-files.ts`, `ai/learning-file.ts`, `ai/media-types.ts`, `transcribeAudio` |

The operational schema already links questions, clusters, human answers, proposals,
approved chunks, versions and durable recheck jobs. It is not necessary to create a
parallel chat-specific knowledge store. Existing release documents are useful pointers,
but their claims are not a substitute for live verification.

## Before this pass

Known questions used authorized retrieval plus scope/trust gates and returned cited
answers. Unknowns recorded a question/cluster and routed according to workspace policy.
Assigned experts and administrators could provide a one-time answer or submit reusable
knowledge for review. Approval queued original-user and external-connection rechecks.

However, Ask held its transcript only in React state and never read those rechecks.
Its “you’ll get an answer here” message promised continuity the UI did not deliver.
It did not show existing company identity. The composer was single-line, image-picker
only, and image previews cropped evidence. Ask had no microphone despite a configured
transcription service elsewhere in the product.

## Findings and fixes

1. **Broken return path:** added an asker-owned progress endpoint and visibility-aware
   polling. A confirmed, still-authorized recheck replaces the unknown result in place.
2. **Authority ambiguity:** progress distinguishes waiting, review, denial, rechecking,
   one-time answer and approved answer. Draft human answers are not returned. Exceptions
   are never labeled reusable policy.
3. **Saved answers are not permanent authorization:** session/RLS reads ownership and
   current source content. Scope and conflict checks run again before returning a saved
   answer. Changed/inaccessible evidence withholds the answer instead of returning it.
4. **Workspace identity:** real organization name, signed logo, or initials are shown.
   No new logo setting or generated artwork was needed.
5. **Composer:** multiline input, Enter/Shift+Enter and IME-aware submission, image
   paste/drop, contained previews, explicit attachment-is-context copy.
6. **Voice:** microphone start/stop/discard, 60-second client cap, bounded server stream,
   authenticated workspace checks, editable transcription, no automatic question send.
   It reuses the existing transcription service. No audio is inserted into Opryn storage.
   This is not a claim about the model provider's retention policy.
7. **Trust hardening:** Ask now fails closed when reading workspace settings fails.
   Image bytes must match PNG/JPEG/WebP/GIF signatures, not just a declared MIME type.
8. **Feedback:** scoped polite announcements; small reduced-motion-aware answer layout
   movement; clear pending/transcribing/error states. Existing Thinking Orb remains for
   genuine answer work. No fabricated provider-search animation was added.

## Canonical vocabulary and page responsibility

| Term/page | Meaning |
| --- | --- |
| Question | A person's request, including follow-up context |
| Knowledge gap | Missing approved guidance underlying one or more questions |
| Unknown | A result state: no approved answer yet; not a system error |
| Expert | A person who can supply the answer, not automatically an approver |
| Human answer | Guidance for the question; not company policy by default |
| Proposal | Reusable guidance awaiting the appropriate human decision |
| Approved knowledge | Reviewed company guidance, subject to current access/scope/trust |
| Resolved gap | Recorded questions verified against approved guidance, not merely answered by a human |
| Ask | Consume approved guidance and discover gaps |
| Teach | Use business inputs to prepare reviewable knowledge |
| Knowledge | Inspect/manage trusted memory and its provenance |
| Needs You | Human decisions, exceptions, and actionable recovery work |
| Team | Expertise, approver authority and ownership |
| Connections | Manage learning inputs and authorized consumption surfaces |
| Home | Handled work, necessary decisions and evidence-based teaching priorities |

This vocabulary is documented, **not yet applied exhaustively to every screen**.

## Areas deliberately preserved

No public-site redesign, pricing/entitlement changes, homepage redesign, integration
rewrite, onboarding rewrite, AI-policy rewrite, feature deletion, production data writes,
or new analytics events. Existing recheck jobs remain the authority for gap resolution.
Reading progress does not create questions, count reuse, run a model, or close a gap.
No schema migration or destructive operation is introduced.

## Tests and evidence

- New `verify-question-progress.mjs`: 20 service cases with the actual trust/scope code;
  ownership, disabled Ask, draft withholding, one-time/exception, denial, review,
  successful answer, revoked/deleted/changed sources, conflict, missing scope/citations,
  and database errors. Database/auth responses are fixtures.
- New `verify-ask-voice.mjs`: 10 route cases for authentication, workspace setting,
  origin, type, empty input, declared/actual size, transcript length and failures.
  Audio and transcription are fixtures, not real microphone/model validation.
- Existing human-answer transaction, gap SQL, gap recheck service, external recheck,
  scope/testbench, and source freshness/import service suites were executed successfully.
  Their PostgreSQL/model/provider boundaries are isolated; not live Supabase E2E.
- Production build, TypeScript and repository lint passed. No live end-to-end or
  browser result is implied by these checks. Graphify's AST graph was updated.
- Browser service returned no applications/browsers and “native pipe startup failed.”
  No new screenshots, recording, real microphone test or visual accessibility claim.

## Remaining release blockers and required next phases

1. Complete the requested whole-product inventory and actual rendered walkthroughs:
   public, onboarding, Home, Ask, Teach, Knowledge, Needs You, Team, Connections,
   Settings/billing and Guide. This report is code-backed core-loop work, not that full audit.
2. General document attachments in Ask are unfinished. Teach's PDF/Word/text pipeline
   exists, but must not be reused by creating company processes on every chat upload.
   Add authorized temporary attachment context, clear Attachment Answer provenance,
   deliberate Teach handoff, and the requested combined file+image scenario.
3. Add a distributed per-member voice cost/rate budget before production release.
   Current byte/time checks bound individual input, not aggregate model spend.
4. Verify microphone permission denial, cancellation, mobile Safari codecs, real
   transcription and server/provider failure handling in a browser.
5. Conversation history is still in-memory; reloading loses the current transcript.
   Progress closes the loop while it is open, not a full durable conversation experience.
6. Saved recheck validation conservatively compares source `updated_at` with `checked_at`.
   Even a non-content update may require another question. Durable per-citation version
   snapshots would permit precise replay and are a safe additive migration candidate.
7. Detailed live retrieval stages are not exposed by the current JSON Ask endpoint.
   Keep the truthful general search state until backend stage events exist.
8. Conflict/restricted/proposed results need richer first-class Ask states. Current
   trust gate safely withholds them but may present a generic unknown.
9. Source metadata still uses the existing source resolver; full provider identity,
   human-readable paths and relevant-excerpt drawers need broader verification.
10. Run the requested real multi-role refund journey against an isolated workspace,
    including approval, original-chat update and a genuinely similar subsequent query.
    Existing fixtures do not constitute this E2E proof.
11. Review freshness's existing 90/180-day defaults with actual governance requirements;
    they are concrete rules but not necessarily meaningful for every business.
12. Inspect analytics definitions, notification deep links, mobile sheets and onboarding
    ordering end-to-end before answering all final product-quality questions affirmatively.

No claim is made that every requested capability or phase is complete. Deployment must
wait for the unfinished functionality and release checks, not just a passing compilation.
