import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Server-only transport. Never return a raw Nango response to a browser. */
export class ConnectionError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}

export function nangoEnvironment() {
  const environment = process.env.NANGO_ENVIRONMENT?.trim();
  if (
    !environment ||
    !process.env.NANGO_SECRET_KEY ||
    !process.env.NANGO_WEBHOOK_SECRET
  )
    throw new ConnectionError("Connection setup is not available yet.");
  if (
    process.env.VERCEL_ENV !== "production" &&
    environment.toUpperCase() === "PROD"
  )
    throw new ConnectionError(
      "Production connections are disabled in this environment.",
    );
  return environment;
}

export async function nangoRequest(path: string, init: RequestInit = {}) {
  nangoEnvironment();
  const response = await fetch(`https://api.nango.dev${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${process.env.NANGO_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  // Provider error bodies can contain credentials. Never log or forward them.
  if (!response.ok)
    throw new ConnectionError(
      response.status === 404
        ? "Connection not found."
        : "The connection service could not complete this request. Please try again.",
      response.status === 404 ? 404 : response.status === 424 ? 424 : 503,
    );
  return response;
}

export function connectionPath(integrationId: string, connectionId: string) {
  return `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integrationId)}`;
}

const connectionSchema = z.object({
  connection_id: z.string(),
  provider_config_key: z.string(),
  tags: z.record(z.string(), z.string()),
  errors: z.array(z.object({ type: z.string() })).default([]),
});

const oauthConnectionSchema = connectionSchema.extend({
  credentials: z.object({
    type: z.literal("OAUTH2"),
    access_token: z.string().min(1),
    expires_at: z.union([z.string(), z.number()]).optional(),
  }),
});

export async function readNangoConnection(
  integrationId: string,
  connectionId: string,
) {
  const response = await nangoRequest(
    connectionPath(integrationId, connectionId),
  );
  // Zod strips credentials, metadata and all other unneeded fields immediately.
  return connectionSchema.parse(await response.json());
}

/**
 * Google Picker is a browser API and requires a short-lived OAuth access token.
 * Callers must return only access_token (never refresh_token) from an authenticated,
 * no-store route. The token must remain in memory and must not be logged or persisted.
 */
export async function readNangoPickerCredential(
  integrationId: string,
  connectionId: string,
) {
  const response = await nangoRequest(
    connectionPath(integrationId, connectionId),
  );
  return oauthConnectionSchema.parse(await response.json());
}

export function verifyNangoWebhook(
  body: string,
  signature: string | null,
  key: string,
) {
  if (!key || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", key).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export const nangoAuthEventSchema = z.object({
  type: z.literal("auth"),
  operation: z.enum(["creation", "override", "refresh", "deletion"]),
  connectionId: z.string().min(1).max(255),
  providerConfigKey: z.string().min(1).max(255),
  environment: z.string(),
  success: z.boolean(),
  tags: z.record(z.string(), z.string()).default({}),
});
