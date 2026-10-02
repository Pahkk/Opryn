# Ask progress release — 2026-09-18

The user explicitly requested deployment of the initial implementation slice.
This is not a claim that the broader product audit or full Ask redesign is complete.

## Release contents

- Original-question progress and permission/scope/trust-checked approved-answer return.
- Explicit one-time human-answer, review, denial, dismissal and recheck states.
- Workspace identity, multiline questions and image paste/drop with contained previews.
- Fail-closed settings lookup and image signature validation.
- **Voice is disabled** by a shared UI/server release gate. The endpoint returns 503
  before authentication, storage or model processing. Enable only after distributed
  rate limiting and real microphone/provider QA; hiding the microphone alone is insufficient.

No migrations, production fixtures, customer approvals, provider imports or model calls
were performed during release verification. Existing marketing design is preserved.

## Verification

- TypeScript, ESLint, 20 question-progress service cases and 10 voice route fixture
  cases passed. An additional test verifies the actual disabled release gate.
- Remote production build compiles and typechecks against production configuration.
- Read-only zero-row Supabase checks confirmed required columns in employee questions,
  gap rechecks, proposals, human answers and knowledge chunks. No customer rows returned.
- Browser/microphone and authenticated multi-role end-to-end validation remain unverified.

## Deployment

- Candidate: `dpl_Bf4LDSBCYBDfragJadNFez2nUsAA`
- Candidate URL: https://handoff-qriu1isvo-nikitas-projects-acfaddb7.vercel.app
- Git base: `c30317c` plus existing workspace changes; no commit/reset performed.
- Previous production / rollback target: `dpl_DcaqgADW4Fb8iAKXNkwvj3gZK2E2`
  (https://handoff-6m9iwivxo-nikitas-projects-acfaddb7.vercel.app).
- Candidate built with production configuration and domain assignment deferred until smoke checks.

See `product-coherence-audit-2026-09-18.md` for the broader unfinished work. Its initial
“not deployed” statement describes the prior turn; this release record supersedes it
only after promotion is confirmed below.

## Promotion confirmed

- Promoted successfully to https://www.opryn.app; domain inspection resolves to
  `dpl_Bf4LDSBCYBDfragJadNFez2nUsAA`, status **Ready**, target **production**.
- Candidate and live-domain checks: `/`, `/ai`, `/pricing` return 200; anonymous
  question-progress requests return 401; voice POST returns the intentional 503 gate.
- Error-level deployment log scan for the release window returned no entries.
  This is a short smoke-check window, not ongoing monitoring or authenticated E2E.
- Previous deployment retained for rollback. No schema migration was needed.
