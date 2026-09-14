import { test, expect } from "@playwright/test";

test("Nango management endpoints require a signed-in organization admin", async ({
  request,
}) => {
  const id = "10000000-0000-4000-8000-000000000001";
  for (const path of [
    "session",
    id,
    `attempts/${id}`,
    `${id}/files`,
    `${id}/picker`,
  ]) {
    const response = await request.get(`/api/integrations/nango/${path}`);
    expect(response.status()).toBe(401);
  }
  for (const path of ["session", `${id}/import`]) {
    const response = await request.post(`/api/integrations/nango/${path}`, {
      data: {},
    });
    expect(response.status()).toBe(401);
  }
  const response = await request.delete(`/api/integrations/nango/${id}`);
  expect(response.status()).toBe(401);
});

test("Nango webhook fails closed without a valid signature", async ({
  request,
}) => {
  const response = await request.post("/api/webhooks/nango", {
    data: { type: "auth", success: true },
  });
  expect([401, 503]).toContain(response.status());
});
