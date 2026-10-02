import { expect, test } from "@playwright/test";

test("page renders without overflow and navigation works", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Teach your business once.",
  );
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name === "desktop") {
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Product", exact: true })
      .click();
    await expect(page).toHaveURL(/#answer-everywhere$/);
  } else {
    await page.getByRole("button", { name: "Toggle navigation menu" }).click();
    const mobileNavigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    await expect(mobileNavigation).toBeVisible();
    await mobileNavigation
      .getByRole("link", { name: "Pricing", exact: true })
      .click();
    await expect(page).toHaveURL(/\/pricing$/);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-page.png`,
    fullPage: true,
  });
});

test("pricing clearly separates Starter and Pro", async ({ page }) => {
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Choose what fits your business today." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pro" }),
  ).toBeVisible();
  await expect(page.getByText("$49", { exact: true })).toBeVisible();
  await expect(page.getByText("$129", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Video and screen-recording learning"),
  ).toBeVisible();
  await expect(
    page.getByText("Learn from selected calls", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("External AI connections + Agent API"),
  ).toBeVisible();
  await expect(
    page.getByText("Documents, text and audio learning"),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("primary calls to action lead to signup", async ({ page }) => {
  await page.goto("/");
  const ctas = page.getByRole("link", { name: "Get Started" });
  expect(await ctas.count()).toBeGreaterThanOrEqual(2);
  for (const cta of await ctas.all())
    await expect(cta).toHaveAttribute(
      "href",
      /^\/signup(?:\?plan=(core|premium))?$/,
    );
});

test("one illustrative workflow keeps approval and source visible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const example = page.locator(".knowledge-flow");
  await expect(
    page.locator(".flow-caption").getByText("Example workflow"),
  ).toBeVisible();
  await expect(
    example.getByRole("button", { name: "Approved", exact: true }),
  ).toBeVisible();
  await expect(
    example.getByText("Project-lead approval required.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(example.getByText("Source attached")).toBeVisible();
});

test("Sign in opens the existing email and Google entry flow", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation menu" }).click();
  }

  await page
    .locator(".public-nav")
    .getByRole("link", { name: "Sign In", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
});

test("public legal pages are linked and accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Privacy Policy", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/Only files you explicitly choose are imported/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Terms", exact: true }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(
    page.getByRole("heading", { name: "Terms of Service", level: 1 }),
  ).toBeVisible();
});
