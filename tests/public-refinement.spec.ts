import { expect, test } from "@playwright/test";

test("homepage explains the product without rotating positioning", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".knowledge-rotator")).toHaveCount(0);
  await expect(page.locator(".editorial-hero .editorial-lead")).toContainText(
    "processes, policies, and answers",
  );
  await expect(
    page.locator(".editorial-hero .editorial-footnote"),
  ).toContainText("Decide what becomes official");
});

test("product proof is one readable static example with no pinning", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".typing-reserve")).toHaveCount(0);
  await expect(page.locator(".knowledge-flow")).toHaveCount(1);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await expect(
    page.locator(".flow-caption").getByText("Example workflow"),
  ).toBeVisible();
  await expect(
    page.locator(".flow-answer").getByText("Approved · Revision policy"),
  ).toBeVisible();
});

test("integration discovery searches, filters and expands without connecting", async ({
  page,
}) => {
  await page.goto("/integrations");
  await page.getByLabel("Search integrations").fill("Google");
  await expect(page.locator("details")).toHaveCount(1);
  await page.locator("summary").click();
  await expect(page.locator("details")).toHaveAttribute("open", "");
  await expect(
    page.locator("details").getByRole("link", { name: "Get started" }),
  ).toHaveAttribute("href", "/signup");
  await page.getByLabel("Search integrations").fill("");
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.locator("details")).toHaveCount(4);
  await page.getByLabel("Search integrations").fill("not-a-provider");
  await expect(
    page.getByRole("heading", { name: /No integration found/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Request an integration/ }),
  ).toHaveAttribute("href", /\/contact/);
});

test("contact explains email draft delivery and validates required fields", async ({
  page,
}) => {
  await page.goto("/contact?topic=Integration%20request");
  await expect(page.getByLabel("Topic")).toHaveValue("Integration request");
  await expect(
    page.getByText(/Nothing is submitted through this website/),
  ).toBeVisible();
  await page.getByRole("button", { name: /Open email draft/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  expect(
    await page
      .locator("form")
      .evaluate((form: HTMLFormElement) => form.checkValidity()),
  ).toBe(false);
  await expect(
    page
      .getByRole("link", { name: "usersupport@opryn.app", exact: true })
      .first(),
  ).toHaveAttribute("href", "mailto:usersupport@opryn.app");
});

test("public destinations have canonical and social metadata", async ({
  page,
}) => {
  const titles = new Set<string>();
  for (const route of [
    "/",
    "/pricing",
    "/ai",
    "/integrations",
    "/about",
    "/security",
    "/contact",
  ]) {
    await page.goto(route);
    titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://www.opryn.app${route === "/" ? "" : route}`,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /\S+/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary",
    );
    await expect(page.locator("h1")).toHaveCount(1);
  }
  expect(titles.size).toBe(7);
});
