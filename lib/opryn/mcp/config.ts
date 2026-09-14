import "server-only";

export const OPRYN_MCP_SCOPES = [
  "opryn.knowledge.read",
  "opryn.processes.read",
  "opryn.sources.read",
  "opryn.escalations.create",
  "opryn.learning.create",
  "opryn.processes.create",
  "opryn.processes.approve",
] as const;

export type OprynMcpScope = (typeof OPRYN_MCP_SCOPES)[number];

export const OPRYN_MCP_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.opryn.app"
).replace(/\/$/, "");

export const OPRYN_MCP_RESOURCE = `${OPRYN_MCP_ORIGIN}/api/mcp`;
export const OPRYN_MCP_ISSUER = OPRYN_MCP_ORIGIN;
export const MCP_ACCESS_TOKEN_SECONDS = 60 * 60;
export const MCP_REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;
export const MCP_AUTHORIZATION_CODE_SECONDS = 60 * 5;

export function normalizeScopes(value: string | null | undefined) {
  const requested = new Set((value || "").split(/\s+/).filter(Boolean));
  const scopes = OPRYN_MCP_SCOPES.filter((scope) => requested.has(scope));
  return scopes.length ? scopes : [...OPRYN_MCP_SCOPES];
}

export function inferMcpClientKind(name: string | null | undefined) {
  const normalized = (name || "").toLowerCase();
  if (normalized.includes("chatgpt") || normalized.includes("openai"))
    return "chatgpt" as const;
  if (normalized.includes("claude") || normalized.includes("anthropic"))
    return "claude" as const;
  return "custom_mcp" as const;
}

export function mcpQuestionOrigin(kind: "chatgpt" | "claude" | "custom_mcp") {
  return kind === "chatgpt"
    ? "mcp_chatgpt"
    : kind === "claude"
      ? "mcp_claude"
      : "mcp_custom";
}
