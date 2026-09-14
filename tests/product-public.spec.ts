import { expect, test } from "@playwright/test";

test("protected product routes send signed-out users to login", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await page.goto("/app/training");
  await expect(page).toHaveURL(/\/login$/);
});

test("email auth pages are complete and responsive", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByLabel("Full name").fill("Test Owner");
  await page.getByLabel("Work email").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.getByText("Password must be at least 8 characters.", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});

test("invite flow stays on Opryn and preserves the access code", async ({
  page,
}) => {
  const code = "OPRYN-7K3M-9Q2D";
  await page.goto(`/join/${code}`);
  await expect(
    page.getByRole("heading", { name: "Join your Opryn workspace." }),
  ).toBeVisible();
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  const next = `/onboarding?mode=join&code=${encodeURIComponent(code)}`;
  const signIn = page.getByRole("link", { name: "Sign in and join" });
  await expect(signIn).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(next)}`,
  );
  const createAccount = page.getByRole("link", {
    name: "Create account and join",
  });
  await expect(createAccount).toHaveAttribute(
    "href",
    `/signup?next=${encodeURIComponent(next)}`,
  );

  await page.goto(`/invite/${code}`);
  await expect(page).toHaveURL(new RegExp(`/join/${code}$`));
});

test("product APIs reject unauthenticated requests without leaking details", async ({
  request,
}) => {
  const endpoints = [
    [
      "/api/onboarding",
      {
        name: "Test",
        industry: "Services",
        employeeCount: 1,
        ownerRole: "Owner",
        businessDescription: "A local service business.",
        repeatedWork: "Customer intake and scheduling.",
        hardestToHandoff: "Preparing estimates.",
        commonQuestions: "Discount approvals.",
        ownerGoal: "Delegate routine work.",
      },
    ],
    [
      "/api/onboarding/industry-search",
      { query: "we install security cameras for homes" },
    ],
    [
      "/api/onboarding/tool-search",
      { query: "the place where our developers store code" },
    ],
    [
      "/api/processes",
      { title: "Test", inputType: "text", explanation: "First do the work." },
    ],
    [
      "/api/processes/00000000-0000-4000-8000-000000000000/training-media",
      {
        name: "training.png",
        type: "image/png",
        size: 1000,
        caption: "Example training image",
      },
    ],
    ["/api/ask", { question: "What is our refund policy?" }],
    [
      "/api/recommendations",
      {
        businessDescription: "A local service business.",
        repeatedWork: "Customer intake.",
        hardestToHandoff: "Preparing estimates.",
      },
    ],
    ["/api/team/invites", { email: "employee@example.com" }],
    [
      "/api/team/experts",
      {
        userId: "00000000-0000-4000-8000-000000000000",
        category: "Refunds",
        canApprove: false,
      },
    ],
    [
      "/api/learning-inbox",
      {
        action: "confirm_knowledge",
        knowledgeId: "00000000-0000-4000-8000-000000000000",
      },
    ],
    [
      "/api/questions/00000000-0000-4000-8000-000000000000/feedback",
      { feedbackType: "not_right", reason: "wrong_policy" },
    ],
    [
      "/api/notifications/read",
      { ids: ["00000000-0000-4000-8000-000000000000"] },
    ],
    ["/api/billing/checkout", { plan: "premium", interval: "month" }],
    [
      "/api/ai-connections",
      {
        name: "Website Support Agent",
        provider: "custom_agent",
        scopes: ["knowledge:read"],
        access: [],
      },
    ],
    [
      "/api/calls",
      {
        title: "Test call",
        callType: "sales",
        originalName: "call.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 1000,
      },
    ],
  ] as const;
  for (const [url, data] of endpoints) {
    const response = await request.post(url, { data });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Please sign in again.");
    expect(JSON.stringify(body)).not.toContain("stack");
  }

  for (const method of ["patch", "delete"] as const) {
    const response = await request[method]("/api/team/invites", {
      data: { inviteId: "00000000-0000-4000-8000-000000000000" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Please sign in again.");
    expect(JSON.stringify(body)).not.toContain("stack");
  }

  const training = await request.put("/api/training/assignments", {
    data: {
      processId: "00000000-0000-4000-8000-000000000000",
      userIds: [],
    },
  });
  expect(training.status()).toBe(401);
  expect(await training.json()).toEqual({ error: "Please sign in again." });
});

test("external agent endpoints require a valid Opryn agent key", async ({
  request,
}) => {
  const requests = [
    ["/api/v1/answer", { question: "What is our refund policy?" }],
    ["/api/v1/knowledge/search", { query: "refund policy", limit: 5 }],
    ["/api/v1/escalations", { question: "Can this refund be approved?" }],
  ] as const;
  for (const [url, data] of requests) {
    const response = await request.post(url, { data });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "invalid_api_key" });
  }
});

test("communication webhooks reject unverified provider requests", async ({
  request,
}) => {
  const slack = await request.post("/api/webhooks/slack", {
    data: {
      type: "event_callback",
      team_id: "T_FAKE",
      event: { type: "app_mention", user: "U_FAKE", text: "hello" },
    },
  });
  expect(slack.status()).toBeGreaterThanOrEqual(400);

  const teams = await request.post("/api/webhooks/teams", {
    data: { type: "message", id: "fake", text: "hello" },
  });
  expect(teams.status()).toBeGreaterThanOrEqual(400);

  const cron = await request.get("/api/cron/communication-messages");
  expect(cron.status()).toBe(401);
});
