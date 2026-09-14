import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function secret() {
  const value =
    process.env.MCP_TOKEN_HASH_SECRET?.trim() ||
    process.env.EXTERNAL_AGENT_KEY_PEPPER?.trim();
  if (!value) throw new Error("MCP token security is not configured.");
  return value;
}

export function randomOAuthValue(prefix: string, bytes = 32) {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

export function hashOAuthValue(value: string) {
  return createHmac("sha256", secret()).update(value, "utf8").digest("hex");
}

export function verifyPkce(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const actual = createHash("sha256").update(verifier).digest("base64url");
  const left = Buffer.from(actual);
  const right = Buffer.from(challenge);
  return left.length === right.length && timingSafeEqual(left, right);
}
