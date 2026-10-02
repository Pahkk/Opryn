# Bright Opryn identity — implementation and verification

## Inspected

Inspected the current production homepage at https://www.opryn.app visually in Chrome and captured its rendered states using Playwright. Inspected repository homepage, onboarding, company-profile assistance, billing-choice UI, Teach workflows, shared public actions, accessible native dialog, Motion utilities, GSAP setup and six-stage timeline.

Live authenticated onboarding redirected to sign-in. No available authenticated session was used. Onboarding screenshots and journey checks use the actual components with mocked services, not a production customer account.

Previous homepage: hero/example → six-stage story → Inside Opryn screenshot tabs → Why Opryn/category comparison → people/AI → integrations → trust → pricing → final CTA/footer.

New homepage: hero/example → six-stage story → one-source audience demonstration → integrations → trust → pricing → final CTA/footer. Existing empty social-proof infrastructure remains empty.

## Design and interaction changes

- Shared scoped warm-paper, cobalt, sky, apricot and ink tokens; rounded demonstrations, controls, panels and onboarding surfaces. Official Opryn and provider logos unchanged.
- Persistent white, cobalt-edged source surfaces with apricot source labels and meaningful approved status.
- New “See one answer work everywhere” demonstration. A single stable example policy supports every illustrated teammate, website-bot and call-agent answer. No messages, calls, AI requests or approvals are triggered.
- Actual sanitized product screenshots remain available through a secondary interface-preview dialog rather than a major navigation-gallery section.
- Reused public Motion action primitives for pill CTAs, rolling labels and arrows, Motion tabs for audience selection, AnimatePresence for local content, and the existing accessible native dialog. Safari launcher focus is explicitly preserved for dialog dismissal.
- Natural hero typing holds completed phrases for three seconds with the existing pause control, reserved dimensions, accessible fallback and reduced-motion behavior.
- Consolidated goal selection into Company Setup. Presentation now follows Your business → Teach → Review → Try an answer → Trial or plan → Dashboard. Legacy persisted goal-stage sessions normalize to Company Setup; backend stage contracts are retained.
- Company preview reflects current form values; proposed AI suggestions remain separate until explicitly accepted. Context is clearly not approved knowledge. Existing thinking-orb wrapper is used only for the real suggestion request.
- Reused expandable Teach workflow panels and inline connection flows. Did not replace authorization or provider pickers with marketing animations.

## GSAP findings and ownership

No current production animation failure was reproduced. Baseline and changed implementations passed Chromium/WebKit native wheel, trackpad-like deltas, reverse seek, resize alignment and navigation checks. No unsupported failure root cause is asserted.

Verified design issue: timeline background colors were hardcoded to the superseded slate palette. They now read the scoped stage tokens. The deterministic reversible master timeline remains: Information 0, Structure 14, Review 31, Approved 46, Use 60, Learn 82, Final 97. Scroll distance is viewport-tuned within 4500–5200px; scrub remains 0.9. Measured Flip geometry is integrated into seekable transforms, not repeated React mutations during scrolling. SplitText masks and controlled refresh/cleanup are retained.

GSAP exclusively owns story transforms, paths and progress. Motion owns local React UI state. No page-wide Motion layout wrapper or transformed ancestor was added around the pin. Static reading, Skip story, vertical mobile layout and reduced-motion sequence remain available.

## Dependencies and protected behavior

Motion 13.3.0 and GSAP 3.15.0 were already installed. No additional dependency or Motion+ import was added. Studied official rolling-text, folder continuity, dialog, smooth-tab and status-example principles; implemented original equivalents with stable APIs because example source is paid-access.

No database, billing endpoint, Stripe price, trial eligibility, payment disclosure, entitlement, permission, integration backend or approval rule was changed in this design pass.

## Verification and artifacts

- Typecheck, ESLint and production build passed; 113 static pages generated.
- Actual onboarding components passed at 1440, 768, 390, 360 and WebKit 430px, including explicit suggestion acceptance, inline Google connection sheet, Explain → review → approve → sourced answer → billing retry → completion and saved-source resume. Services are mocked.
- Bright homepage interactions passed Chromium and WebKit at 1440, 768 and 390px: rapid audience changes, stable authority object, dialog open/close, Escape and restored focus, no horizontal overflow and reduced motion.
- Production-build GSAP stress checks passed Chromium and WebKit: wheel, reverse scroll, resize, Back, mobile progress and reduced motion.
- Production-build product screenshot tabs checked across desktop and mobile geometries for responsive retina assets, keyboard operation and reduced motion.
- Before captures: `artifacts/home-refresh/bright-before/`.
- After captures: `artifacts/home-refresh/bright-after/` and `artifacts/bright-identity/`.
- Onboarding captures: `artifacts/activation/`.
- Motion recordings: `artifacts/bright-identity/recordings/` and `artifacts/home-refresh/qa/recordings/`.

## Limits / remaining verification

Real external OAuth, provider authorization, production AI suggestions and Stripe payment/webhook execution were not performed. Existing business paths were preserved and local UI journeys exercised with mocks. Typing during delayed production suggestions and genuine OAuth full-page return require an authenticated test workspace; they are not claimed as visually verified. Recordings are browser-test traces, not a polished customer demo. No deployment was performed.
