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
    await expect(page).toHaveURL(/#inside-opryn$/);
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

test("pricing clearly separates Core and Premium", async ({ page }) => {
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "Company knowledge for people and AI." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Opryn Core" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Opryn Premium" }),
  ).toBeVisible();
  await expect(
    page.getByText("Video and screen-recording learning"),
  ).toBeVisible();
  await expect(
    page.getByText("Learn From Calls", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("External AI Connections and secure Agent API"),
  ).toBeVisible();
  await expect(
    page.getByText("Document uploads and Google Drive import"),
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
    await expect(cta).toHaveAttribute("href", "/signup");
});

test("illustrative product demo grounds both consumers in the displayed source", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page
      .locator(".shared-policy")
      .getByText(/Website projects include two revision rounds/),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Website bot",
      exact: true,
    })
    .click();
  await expect(page.locator(".shared-answer-stack .is-current h3")).toHaveText(
    "Additional rounds require project lead approval.",
  );
  await expect(
    page
      .locator(".editorial-trust")
      .getByText(
        "No approved answer found. Route the question to the right person.",
      ),
  ).toBeVisible();
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
