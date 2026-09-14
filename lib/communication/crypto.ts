import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { ProviderCredentials } from "@/lib/communication/types";

const VERSION = "v1";

function encryptionKey() {
  const configured =
    process.env.COMMUNICATION_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!configured)
    throw new Error("Communication credential encryption is not configured.");
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32)
    throw new Error(
      "COMMUNICATION_CREDENTIALS_ENCRYPTION_KEY must contain 32 bytes.",
    );
  return key;
}

export function encryptProviderCredentials(value: ProviderCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptProviderCredentials(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue)
    throw new Error("Stored communication credentials are invalid.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const parsed = JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as ProviderCredentials;
  if (parsed.provider !== "slack" && parsed.provider !== "teams")
    throw new Error("Stored communication credentials are invalid.");
  return parsed;
}

export function hashCommunicationToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createCommunicationToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
