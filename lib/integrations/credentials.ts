import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const configured = (
    process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.COMMUNICATION_CREDENTIALS_ENCRYPTION_KEY ||
    ""
  ).trim();
  if (!configured)
    throw new Error("Integration credential encryption is not configured.");
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32)
    throw new Error("Integration credential encryption must contain 32 bytes.");
  return key;
}

export function encryptIntegrationCredentials(input: {
  organizationId: string;
  providerId: string;
  credentials: Record<string, string>;
}) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${input.organizationId}:${input.providerId}`));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(input.credentials), "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptIntegrationCredentials(input: {
  organizationId: string;
  providerId: string;
  encryptedPayload: string;
}) {
  const [version, iv, tag, encrypted] = input.encryptedPayload.split(":");
  if (version !== VERSION || !iv || !tag || !encrypted)
    throw new Error("Stored integration credentials are invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from(`${input.organizationId}:${input.providerId}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const value = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(value) as Record<string, string>;
}

export function credentialHint(credentials: Record<string, string>) {
  const secret =
    credentials.apiToken ||
    credentials.accessToken ||
    credentials.clientSecret ||
    credentials.refreshToken ||
    "";
  return secret
    ? {
        ending: secret.slice(-4),
        account:
          credentials.shopDomain ||
          credentials.companyDomain ||
          credentials.baseUrl ||
          credentials.email ||
          null,
      }
    : { account: credentials.delegatedEmail || null };
}
