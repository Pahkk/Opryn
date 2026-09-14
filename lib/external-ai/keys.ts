import "server-only";

import { createHmac, randomBytes } from "node:crypto";

export function generateAgentCredentials() {
  return {
    agentId: `agt_${randomBytes(12).toString("base64url")}`,
    apiKey: `opryn_agent_${randomBytes(32).toString("base64url")}`,
  };
}

export function hashAgentKey(rawKey: string) {
  const pepper = process.env.EXTERNAL_AGENT_KEY_PEPPER?.trim();
  if (!pepper)
    throw new Error("External agent key security is not configured.");
  return createHmac("sha256", pepper).update(rawKey, "utf8").digest("hex");
}

export function displayKeyPrefix(rawKey: string) {
  return `${rawKey.slice(0, 20)}…`;
}
