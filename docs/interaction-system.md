# Opryn interaction system

## Ownership

Motion owns React selection transitions, press feedback, action arrows/rolling labels and the measured SVG perimeter trace. Existing GSAP storytelling is untouched. CSS owns small hover/focus color, underline and 1–3px detail feedback. No whole-page layout animation, global cursor tracking or new dependency.

## Shared primitives and use

| Pattern | Implementation | Applied locations |
| --- | --- | --- |
| Text link | `.opryn-link`, selected semantic link selectors, growing underline | Navigation, footer, Teach management, public text actions |
| Primary action | Existing `PublicAction` and `MotionButton` | Homepage/navigation CTAs, AI page CTAs, onboarding company action; existing product button colors deepen |
| Selection surface | `MotionTabs`/`ActiveIndicator` with scoped `layoutId` | Knowledge views/categories, public filters, audience selectors, screenshot tabs, Settings, pricing interval, onboarding goals |
| Knowledge row | `.library-row` signature rail/tint/title/source/action feedback | Knowledge library, including keyboard focus and always-visible touch action |
| Integration row | `.integration-provider-row`, `.public-provider`, `.home-connection` | Connections catalog, public integrations/home rows, Teach Use Opryn Elsewhere |
| Teach panel | `.teach-source-row` tint/content lift, accurate provider identity, restrained Google document icon separation | Google Workspace, Notion, Confluence source surfaces |
| Feature/decision panel | `.opryn-feature-panel`, `.needs-you-card`, `.team-interaction-row` | Needs You and Team membership/invitation surfaces; optional feature-panel class for future interactive panels |
| Trace | `OprynTrace` | Teach source rows and homepage audience demo. Measures actual dimensions and radius; draws once on entry/focus and remains a thin cobalt edge until leaving |
| Marker | `.opryn-marker` | One approved-guidance phrase in the marketing audience-demo caption |

`OprynTrace` is decorative, pointer-transparent and never creates a focus target. It responds to the actual controls inside its parent. ResizeObserver and pointer/focus listeners clean up on unmount. Provider logos are never spun, recolored or scaled. Google document marks translate at most 3px apart; their identity stays intact.

## Accessibility and restraint

Keyboard focus receives the same row/panel emphasis, plus a visible cobalt outline. No interaction requires hover to activate. Link and button semantics and event handlers are unchanged. Background indicators are aria-hidden and locally namespaced. Touch layouts expose row actions without hover. Disabled controls do not receive press motion.

Reduced motion disables translations, trace drawing, rolling labels and animated selection movement while retaining readable selected backgrounds, borders and status text. No decorative color replaces green/amber/red meaning. No GSAP story object is targeted by the interaction rules. No sparkle, glow, bounce or large hover scale.

## Verification scope

Typecheck, lint and production-build checks; actual product component fixture verifies source-panel keyboard trace activation/deactivation, stable row height, Knowledge focus tint and metadata, source expansion, review resolution, detail dialog and reduced motion at six viewport widths. Fixtures mock backend services; they do not perform provider OAuth or billing actions. Public browser checks verify audience selectors, dialog, mobile layout and reduced motion. Individual production authenticated pages are not claimed as visually tested without a signed-in session.

Public Chromium and WebKit interaction assertions passed at 1440/768/390px. The WebKit run's final clean-console assertion failed on the previously observed Next.js background-prefetch access-control errors (also reported after the preceding production deployment). This is not reported as a fully clean browser suite; fixing that separate prefetch issue is outside this interaction pass.
