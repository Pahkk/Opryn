import { test, expect } from "@playwright/test";

test("Guide requires a signed-in membership before reading setup or accepting an action", async ({
  request,
}) => {
  const context = await request.get("/api/guide");
  expect(context.status()).toBe(401);
  const show = await request.post("/api/guide", {
    data: { action: "show", targetId: "team.invite" },
  });
  expect(show.status()).toBe(401);
  const ask = await request.post("/api/guide", {
    data: { action: "ask", path: "/app", question: "How do I teach Opryn?" },
  });
  expect(ask.status()).toBe(401);
  expect(await context.text()).not.toMatch(
    /userId|organizationId|facts|OPENAI/,
  );
});
