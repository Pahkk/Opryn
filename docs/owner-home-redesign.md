# Authenticated Home redesign

The owner Home uses the existing Opryn workflows with a quieter dashboard layout: greeting and actions, a shared summary panel, a primary decision queue, and compact supporting panels for teaching, handled activity, and knowledge health.

## Design

- Neutral slate canvas, white surfaces, consistent 12px panel corners, subtle borders, and the existing cobalt accent.
- Readable greeting and description, with Refresh as a secondary control. The greeting uses local time without word animation.
- Ask is the primary action; Teach, Review, and Invite use matching secondary buttons. On mobile these form a two-column grid.
- Three real summary counts share one panel. Needs You and Knowledge Gaps link to their existing pages. Longer explanatory labels are omitted on small screens.
- Decisions live in one bordered panel with consistent rows, compact status labels, priority badges, source context, and visible action buttons. Full questions remain available in the expandable review.
- Teach Next uses a compact supporting panel and the existing recommendation. A recommendation repeating a decision uses the existing guidance-focused heading rather than repeating the full question.
- Recently Handled and Knowledge Health use the same spacing, typography, and panel treatment. Supporting analysis stays in its existing disclosure.
- Icons for Home actions and the teaching panel use Lucide, already installed and used by the app shell. The decorative document illustration and trace are removed from Home.

## Behavior

Existing server queries, permissions, routes, inline answer handling, proposal version checks, error/retry states, approval receipts, reduced-motion preferences, and refresh cadence are retained. Counts use real props. No new API, database migration, or dependency is required.

## Verification

Typecheck, targeted ESLint, and the production build passed. The existing real-component browser verifier runs against the complete compiled global stylesheet and component CSS at 390, 768, and 1440px with standard and reduced motion. Its 120 assertions cover layout overflow, keyboard expansion, failure/retry, version payloads, double submission, approval receipts and removal, full review routing, and empty states. The fixture includes a long process question to exercise wrapping. Requests use isolated API doubles and never approve live company knowledge.

Screenshots and recordings are generated locally under artifacts/owner-home. These show the actual React components with example records; they do not represent a signed-in production-session test.

## Release

Existing Vercel project: nikitas-projects-acfaddb7/handoff, serving https://www.opryn.app.

Previous production deployment retained for rollback: https://handoff-jkrk23375-nikitas-projects-acfaddb7.vercel.app (dpl_qKSXrJ1p167ZVK58iHjqzTaP9NND).
