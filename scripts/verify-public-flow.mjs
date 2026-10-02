import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PLAN_DETAILS, PLAN_FEATURES } from "../lib/billing/plans.ts";

const base = process.env.OPRYN_AUDIT_URL || "http://localhost:3236";
let checks = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
};
const pages = {};
for (const route of ["/", "/ai", "/pricing"]) {
  const response = await fetch(base + route);
  check(response.ok, `${route} responds successfully`);
  const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
  pages[route] = html;
  check((html.match(/<h1\b/g) || []).length === 1, `${route} has one H1`);
  check(
    html.includes("opryn-public-editorial"),
    `${route} uses the shared public identity`,
  );
  check(
    html.includes('aria-label="Opryn home"'),
    `${route} has accessible home logo`,
  );
  check(!html.includes("pin-spacer"), `${route} has no scroll pinning`);
  check(html.includes('rel="canonical"'), `${route} has canonical metadata`);
}
check(!pages["/"].includes("clear-example"), "Old nested hero demo removed");
check(pages["/"].includes("Example knowledge flow:"), "Hero example labeled");
check(
  pages["/"].includes("Manager approval is required."),
  "Settled hero answer exists without JavaScript",
);
check(
  pages["/"].includes("Customer Service Handbook"),
  "Refund example source retained",
);
check(
  pages["/"].includes("Can I refund a $750 order?"),
  "Question uses same refund rule",
);
check(!pages["/ai"].includes("editorial-apricot"), "AI has no apricot section");
check(
  (pages["/"].match(/class="opryn-marketing-image"/g) || []).length === 3,
  "Exactly three original marketing graphics remain",
);
check(
  pages["/ai"].includes("Example access policy"),
  "Permission selections clearly labeled example",
);
check(
  pages["/ai"].includes("Compatible connected AI"),
  "AI compatibility qualified",
);
check(
  pages["/ai"].includes("Existing workspace access rules still apply"),
  "Workspace access restrictions retained",
);
check(
  pages["/ai"].includes("does not change your external provider plan"),
  "Provider and Opryn eligibility separate",
);
check(
  pages["/ai"].includes("does not rewrite old conversations"),
  "No remote provider/history automation claim",
);
check(
  pages["/ai"].includes("enabled and authorized"),
  "Unknown-question escalation appropriately qualified",
);
check(
  !pages["/ai"].includes("authority-surface"),
  "Old architecture panel removed",
);
check(
  !pages["/pricing"].includes("<table"),
  "Comparison collapsed on initial render",
);
check(
  pages["/pricing"].includes('id="pricing-comparison-detail"'),
  "Comparison aria-controls target survives collapse",
);
check(
  pages["/pricing"].includes("This page starts a paid plan, not a trial"),
  "Checkout is not falsely described as a trial",
);
for (const plan of ["core", "premium"]) {
  check(
    pages["/pricing"].includes(`$${PLAN_DETAILS[plan].monthlyPrice}`),
    `${plan} price matches canonical plan configuration`,
  );
  check(
    pages["/pricing"].includes(
      `One owner + ${PLAN_FEATURES[plan].teamLimit} employees`,
    ),
    `${plan} seats match entitlements`,
  );
  const href = [...pages["/pricing"].matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replaceAll("&amp;", "&"))
    .find(
      (h) =>
        h.startsWith("/signup?next=") &&
        decodeURIComponent(decodeURIComponent(h)).includes(`checkout=${plan}`),
    );
  check(Boolean(href), `${plan} signup handoff exists`);
  const onboarding = new URL(href, base).searchParams.get("next");
  const pricing = new URL(onboarding, base).searchParams.get("next");
  check(
    new URL(pricing, base).searchParams.get("interval") === "month",
    `${plan} preserves billing interval through onboarding`,
  );
}
const scene = await readFile(
  "components/marketing/knowledge-flow-scene.tsx",
  "utf8",
);
check(
  scene.includes("useProductReducedMotion") && scene.includes("useInView"),
  "Scene respects motion preference and viewport visibility",
);
check(scene.includes("timers.forEach(clearTimeout)"), "Loop timers cleaned up");
check(
  scene.includes("useMotionValue") && scene.includes("useSpring"),
  "Pointer movement does not use per-frame React state",
);
check(
  !scene.includes("OprynThinkingOrb"),
  "No fake AI thinking in public demo",
);
for (const route of [
  "/integrations",
  "/security",
  "/docs/mcp-development",
  "/signup",
  "/contact",
])
  check((await fetch(base + route)).ok, `${route} destination responds`);
const denied = await fetch(base + "/api/billing/checkout", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ plan: "premium", interval: "month" }),
});
check(
  denied.status === 401 || denied.status === 403,
  "Unauthenticated checkout rejected before Stripe",
);
console.log(
  `${checks} public-flow SSR, canonical billing, resumable handoff, safety and destination checks passed. No account, billing or deployment writes.`,
);
