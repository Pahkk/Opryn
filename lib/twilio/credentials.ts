import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const configured = process.env.TWILIO_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!configured)
    throw new Error("Twilio credential encryption is not configured.");
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32)
    throw new Error("TWILIO_CREDENTIALS_ENCRYPTION_KEY must contain 32 bytes.");
  return key;
}

export function encryptTwilioAuthToken(authToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(authToken, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptTwilioAuthToken(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue)
    throw new Error("Stored Twilio credentials are invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
