import { expect, test } from "@playwright/test";
import { PLAN_DETAILS, PLAN_FEATURES } from "../lib/billing/plans";

// Request-only regression checks: no browser control or Stripe transaction.
for (const route of ["/", "/ai", "/pricing"]) {
  test(`${route} renders the shared public identity without JavaScript`, async ({
    request,
  }) => {
    const response = await request.get(route);
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("opryn-public-editorial");
    expect(html).toContain('aria-label="Opryn home"');
    expect(html).not.toContain("pin-spacer");
  });
}

test("home ships a labeled, settled flow and exactly three original graphics", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("Example knowledge flow:");
  expect(html).toContain("Manager approval is required.");
  expect(html).toContain("Customer Service Handbook");
  expect(html).toContain("Can I refund a $750 order?");
  expect(html).not.toContain("clear-example");
  expect(html.match(/class="opryn-marketing-image"/g)).toHaveLength(3);
});

test("AI permission examples and provider limitations are explicit", async ({
  request,
}) => {
  const html = await (await request.get("/ai")).text();
  for (const text of [
    "Example access policy",
    "Existing workspace access rules still apply",
    "does not change your external provider plan",
    "does not rewrite old conversations",
    "enabled and authorized",
  ])
    expect(html).toContain(text);
});

test("pricing uses canonical plans and preserves the resumable checkout intent", async ({
  request,
}) => {
  const response = await request.get("/pricing");
  const html = (await response.text()).replace(/<!--[\s\S]*?-->/g, "");
  expect(html).not.toContain("<table");
  expect(html).toContain('id="pricing-comparison-detail"');
  expect(html).toContain("This page starts a paid plan, not a trial");
  expect(PLAN_DETAILS.core.name).toBe("Starter");
  expect(PLAN_DETAILS.premium.name).toBe("Pro");
  expect(PLAN_DETAILS.core.monthlyPrice).toBe(49);
  expect(PLAN_DETAILS.premium.monthlyPrice).toBe(129);
  for (const plan of ["core", "premium"] as const) {
    expect(html).toContain(`$${PLAN_DETAILS[plan].monthlyPrice}`);
    expect(html).toContain(
      `One owner + ${PLAN_FEATURES[plan].teamLimit} employees`,
    );
    const signup = [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1].replace(/&amp;/g, "&"))
      .find(
        (href) =>
          href.startsWith("/signup?next=") &&
          decodeURIComponent(decodeURIComponent(href)).includes(
            `checkout=${plan}`,
          ),
      );
    expect(signup).toBeTruthy();
    const onboarding = new URL(signup!, "http://localhost").searchParams.get(
      "next",
    )!;
    const pricing = new URL(onboarding, "http://localhost").searchParams.get(
      "next",
    )!;
    const checkout = new URL(pricing, "http://localhost");
    expect(checkout.searchParams.get("checkout")).toBe(plan);
    expect(checkout.searchParams.get("interval")).toBe("month");
  }
});

test("anonymous checkout is denied before Stripe", async ({ request }) => {
  const response = await request.post("/api/billing/checkout", {
    data: { plan: "premium", interval: "month" },
  });
  expect([401, 403]).toContain(response.status());
});
