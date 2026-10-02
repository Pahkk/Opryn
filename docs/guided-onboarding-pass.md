# Guided onboarding implementation pass

Inspected the actual activation route, activation state machine, company form,
suggestions API/schema, setup preview, source setup, plan chooser, Guide registry,
Guide panel and spotlight lifecycle. Current stages are company → teach → review
→ try → plan; existing completion only links into the product. Existing company
setup has optional explicit suggestion acceptance, but does not send the whole
profile to setup analysis. Source choices do not explain the workflow; Notion and
Confluence are hidden. Spotlight can leave a static pointer on mobile/reduced motion.

Plan: retain server approval/billing/learning systems; simplify optional company
details, enrich bounded setup inputs, show a useful live preview, add original silent
example source walkthroughs and real connection labels, celebrate verified first
approval, show actual Ask work, simplify the trial presentation, and add an optional
authorized Guide tour. Improve Guide companion and spotlight cleanup/accessibility.

No production migrations, deployments, prices, permissions or entitlement changes.
Rendered QA uses actual components with isolated API fixtures, not authenticated
production customer data. Provider account authorization and real Stripe Checkout
cannot be established by fixture tests. Microsoft source import is not presented as
available where only guided setup exists. Preview walkthroughs are original Motion
illustrations, not recordings of provider authorization pages.
