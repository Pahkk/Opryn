export type IntegrationAuthMode =
  "native_oauth" | "credential_guide" | "mcp" | "api_key_advanced" | "manual";

export type IntegrationCategory =
  "learn" | "communication" | "ai" | "calls" | "business";

export type IntegrationCapability =
  | "knowledge_import"
  | "ask_opryn"
  | "escalation_notifications"
  | "customer_context"
  | "call_learning"
  | "ai_knowledge_access"
  | "processes_create";

export type IntegrationStatus =
  "connected" | "needs_reauthorization" | "disconnected" | "error";

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  capabilities: readonly IntegrationCapability[];
  description: string;
  aliases?: readonly string[];
  setupTime: string;
  premium: boolean;
  href?: string;
  availability?: "available" | "beta" | "request_only";
  nango?: {
    integrationIdEnv: string;
    adapter: "google_drive" | "notion";
  };
  permissions: {
    can: readonly string[];
    cannot: readonly string[];
    privacy: string;
  };
};

export type SanitizedIntegrationConnection = {
  id: string;
  provider: string;
  externalConnectionId: string;
  externalAccountId: string | null;
  externalAccountName: string | null;
  status: IntegrationStatus;
  capabilities: string[];
  connectedAt: string | null;
  lastUsedAt: string | null;
  lastSyncAt: string | null;
};
