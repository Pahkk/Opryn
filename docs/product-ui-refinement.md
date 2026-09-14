# Authenticated UI refinement — September 9, 2026

## Direction

The authenticated presentation layer in `app/globals.css` scopes the quieter
palette and shared control treatment to `.opryn-app`. Public pages are unchanged.
Keep white for editing, neutral stone for the canvas, blue for actions, and
attention tints for review. Status text remains visible without relying on color.

## Before / after

- Sidebar: emphasized icons and rounded active tiles → smaller icons, medium-weight
  labels, restrained active background, whitespace between navigation groups.
- Home: blue hero panel with label-first metric → neutral featured surface and
  number-first metric. Existing estimates and their explanation are unchanged.
- Needs You: four boxed counters and colored card rails → compact inline summary
  and open decision rows. Existing actions, revision checks, and focus behavior
  are unchanged; detailed sources remain in the review sheet.
- Ask: nested bordered source cards → compact expandable source rows with the
  same supporting passages and links. Question controls remain immediately visible.
- Knowledge: raised approval banner → restrained review panel; library rows use
  light dividers and no lift. Pending items remain prominent.
- Connections: repetitive introduction and heavy search shadow → one concise
  explanation and a quiet search control. Provider availability is unchanged.
- Team: two-column person cards → a readable single-column people list. All access
  and role controls remain available.

## Shared coverage

Home, Ask, Teach/source learning, Needs You, Knowledge, Connections, Team, Learning,
and Settings reuse the app canvas, heading, control, surface, focus, and motion
rules. Calls, health, analytics, role detail, source management, and connection
details inherit these foundations; their individual content layouts were not
rebuilt. No routes, database models, auth, billing, or integration behavior changed.

## Verification scope

Run typecheck, lint, production build, and `scripts/verify-product-ui.mjs`.
The browser harness renders real components with explicit fixture data and API
doubles at 320, 375, 390, 430, 768, and 1280px. This verifies layout and scripted
interactions, not live OAuth, real organization data, or a physical iPhone keyboard.
Screenshots are in `artifacts/product-ux/`; selected previous screenshots are in
`artifacts/product-ux/before-refinement/`.

The harness covers Ask, sources, Needs You decisions and sheets, process editing,
connection search, onboarding, learning counts, Team, and pending approvals.
Authenticated Home and remaining server-only pages still need an account-based
visual walkthrough; do not describe fixture coverage as an all-route live audit.
