import { expect, test } from "@playwright/test";

test("typing line reserves space for every phrase and can pause", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause headline" }).click();
  const heights = await page.locator(".knowledge-rotator").evaluate((root) => {
    const line = root.querySelector(".is-current")!;
    const original = line.textContent;
    const result = [
      "",
      "Help your team get answers.",
      "Get new people up to speed.",
      "Give your agents company context.",
      "Keep knowledge in one place.",
    ].map((text) => {
      line.textContent = text || "\u00a0";
      return root.getBoundingClientRect().height;
    });
    line.textContent = original;
    return result;
  });
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  await expect(page.locator(".knowledge-rotator")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("product proof presents sharp real images in a reduced-motion sequence", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#inside-opryn");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".typing-reserve")).toHaveCount(0);
  const proof = page.locator("#inside-opryn");
  await expect(proof.locator("figure")).toHaveCount(4);
  await expect(proof.locator(".pin-spacer")).toHaveCount(0);
  for (const view of ["teach", "knowledge", "needs-you", "connections"]) {
    const image = proof.locator(`#proof-${view} img`);
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth >= 1170,
        ),
      )
      .toBe(true);
    await expect(image).toHaveAttribute("src", /retina\.webp$/);
  }
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
