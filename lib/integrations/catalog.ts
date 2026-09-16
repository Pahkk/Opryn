import type { IntegrationCatalogItem } from "@/lib/integrations/types";

export const INTEGRATION_CATALOG: readonly IntegrationCatalogItem[] = [
  {
    id: "google_drive",
    nango: {
      integrationIdEnv: "NANGO_GOOGLE_DRIVE_INTEGRATION_ID",
      adapter: "google_drive",
    },
    name: "Google Workspace",
    category: "learn",
    authMode: "native_oauth",
    capabilities: ["knowledge_import"],
    description: "Teach Opryn from the Docs, Sheets, and Slides you choose.",
    aliases: ["drive", "google workspace", "files", "documents"],
    setupTime: "About 1 minute",
    premium: false,
    permissions: {
      can: [
        "Access files you explicitly choose",
        "Read supported Docs, Sheets, and Slides",
        "Keep the original Google file attached as the source",
      ],
      cannot: [
        "Read your entire Drive",
        "Delete your files",
        "Automatically approve imported information",
      ],
      privacy:
        "Opryn imports only the Google files you select. Imported findings remain subject to review before they become approved knowledge.",
    },
  },
  {
    id: "notion",
    nango: {
      integrationIdEnv: "NANGO_NOTION_INTEGRATION_ID",
      adapter: "notion",
    },
    name: "Notion",
    category: "learn",
    authMode: "native_oauth",
    capabilities: ["knowledge_import"],
    description: "Teach Opryn from the Notion pages you choose.",
    aliases: ["wiki", "documents", "knowledge", "pages"],
    setupTime: "About 1 minute",
    premium: false,
    permissions: {
      can: [
        "See pages you share with the Opryn connection",
        "Read pages you explicitly choose for import",
        "Keep the original Notion page attached as the source",
      ],
      cannot: [
        "Edit or delete your Notion content",
        "Read pages that are not shared with the connection",
        "Automatically approve imported information",
      ],
      privacy:
        "Opryn imports only selected pages available to the Notion connection. Findings remain subject to review before they become approved knowledge.",
    },
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    authMode: "native_oauth",
    capabilities: ["ask_opryn", "escalation_notifications"],
    description: "Let your team ask Opryn without leaving Slack.",
    aliases: ["chat", "messaging", "communication"],
    setupTime: "About 2 minutes",
    premium: false,
    href: "/app/integrations/slack",
    permissions: {
      can: [
        "Respond to direct interactions and mentions",
        "Identify authorized workspace members",
      ],
      cannot: [
        "Read your entire Slack history",
        "Change approved company policies",
      ],
      privacy:
        "Opryn only processes direct interactions, supported mentions, and actions addressed to Opryn.",
    },
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "communication",
    authMode: "native_oauth",
    href: "/app/integrations/teams",
    capabilities: ["ask_opryn", "escalation_notifications"],
    description: "Use approved Opryn knowledge from Microsoft Teams.",
    aliases: ["microsoft", "office 365", "chat", "communication"],
    setupTime: "About 2 minutes",
    premium: false,
    permissions: {
      can: [
        "Connect an authorized Microsoft account",
        "Identify the connected tenant",
      ],
      cannot: [
        "Read every Teams conversation",
        "Bypass Opryn member permissions",
      ],
      privacy:
        "A connection enables only the Opryn capabilities currently supported for Teams.",
    },
  },
  {
    id: "gmail",
    name: "Gmail",
    category: "learn",
    authMode: "credential_guide",
    availability: "request_only",
    capabilities: ["knowledge_import"],
    description: "Bring selected business email knowledge into Opryn.",
    aliases: ["google mail", "email", "google workspace"],
    setupTime: "About 2 minutes",
    premium: false,
    permissions: {
      can: ["Access only the capability and scopes approved during connection"],
      cannot: [
        "Approve extracted knowledge",
        "Expose email outside your organization",
      ],
      privacy:
        "Connecting Gmail does not make every email approved company knowledge.",
    },
  },
  {
    id: "github",
    name: "GitHub",
    category: "learn",
    authMode: "credential_guide",
    capabilities: ["knowledge_import"],
    description: "Bring selected repositories and documentation into Opryn.",
    aliases: ["git", "code", "repositories", "developer"],
    setupTime: "About 1 minute",
    premium: false,
    permissions: {
      can: [
        "Access repositories approved during connection",
        "Import selected documentation for review",
      ],
      cannot: [
        "Change source code",
        "Approve imported content as company policy",
      ],
      privacy:
        "Connecting GitHub does not automatically turn repository content into approved Opryn knowledge.",
    },
  },
  ...guidedKnowledgeProviders(),
  ...guidedBusinessProviders(),
  {
    id: "twilio",
    name: "Twilio Call Learning",
    category: "calls",
    authMode: "manual",
    capabilities: ["call_learning"],
    description: "Learn from selected authorized business call recordings.",
    aliases: ["phone", "voice", "recordings", "calls"],
    setupTime: "Advanced setup",
    premium: true,
    href: "/app/integrations/twilio",
    permissions: {
      can: [
        "Process authorized recorded calls",
        "Create Observed findings for review",
      ],
      cannot: ["Record calls secretly", "Approve call findings automatically"],
      privacy:
        "Twilio currently requires advanced account credentials because its normal connection flow is not OAuth-based.",
    },
  },
  ...aiProviders(),
] as const;

function guidedKnowledgeProviders(): IntegrationCatalogItem[] {
  return [
    guided(
      "confluence",
      "Confluence",
      "knowledge_import",
      "Import selected team documentation for review.",
    ),
    guided(
      "sharepoint",
      "SharePoint",
      "knowledge_import",
      "Bring selected SharePoint knowledge into Opryn.",
    ),
  ];
}

function guidedBusinessProviders(): IntegrationCatalogItem[] {
  return [
    guided(
      "hubspot",
      "HubSpot",
      "customer_context",
      "Connect useful customer context to Opryn workflows.",
    ),
    guided(
      "salesforce",
      "Salesforce",
      "customer_context",
      "Use supported Salesforce context inside Opryn.",
    ),
    guided(
      "pipedrive",
      "Pipedrive",
      "customer_context",
      "Connect supported deal and customer context.",
    ),
    guided(
      "shopify",
      "Shopify",
      "customer_context",
      "Connect supported store context to Opryn.",
    ),
    guided(
      "quickbooks",
      "QuickBooks",
      "customer_context",
      "Connect supported business context from QuickBooks.",
    ),
  ];
}

function guided(
  id: string,
  name: string,
  capability: "knowledge_import" | "customer_context",
  description: string,
): IntegrationCatalogItem {
  return {
    id,
    name,
    category: capability === "knowledge_import" ? "learn" : "business",
    authMode: "credential_guide",
    capabilities: [capability],
    description,
    aliases:
      capability === "customer_context"
        ? ["crm", "customers", "sales", "business"]
        : ["documents", "wiki", "knowledge"],
    setupTime: "About 1–2 minutes",
    premium: false,
    permissions: {
      can: [
        "Use only the account and permissions you provide",
        "Use only Opryn-supported capabilities",
      ],
      cannot: ["Change company policy", "Access another Opryn organization"],
      privacy:
        "Credentials are encrypted and only used by Opryn's server for the capabilities shown here.",
    },
  };
}

function aiProviders(): IntegrationCatalogItem[] {
  const base = {
    category: "ai" as const,
    authMode: "mcp" as const,
    capabilities: ["ai_knowledge_access", "processes_create"] as const,
    premium: true,
    setupTime: "About 3 minutes",
    permissions: {
      can: [
        "Read approved knowledge the signed-in user may access",
        "Request owner or expert guidance",
        "Suggest processes for owner review when authorized",
      ],
      cannot: ["Change company policy", "Access restricted knowledge"],
      privacy:
        "Connected AI tools receive only approved knowledge the authenticated user is allowed to access.",
    },
  };
  return [
    {
      ...base,
      id: "chatgpt",
      name: "ChatGPT",
      description: "Ask ChatGPT to use approved Opryn knowledge.",
      aliases: ["openai", "gpt", "ai assistant"],
      href: "/docs/chatgpt",
    },
    {
      ...base,
      id: "claude",
      name: "Claude",
      description: "Let Claude check how your company handles something.",
      aliases: ["anthropic", "ai assistant"],
      href: "/docs/claude",
    },
    {
      ...base,
      id: "custom_agent",
      name: "Custom AI Agent",
      authMode: "api_key_advanced" as const,
      description: "Connect an existing agent through MCP or the Opryn API.",
      aliases: ["api", "mcp", "developer", "bot", "automation"],
      setupTime: "Developer setup",
      href: "/app/ai-connections/new",
    },
  ];
}

export function getIntegrationCatalogItem(id: string) {
  return INTEGRATION_CATALOG.find((provider) => provider.id === id);
}

/** Credential storage alone is not an implemented product capability. */
export function isIntegrationReady(provider: IntegrationCatalogItem) {
  return (
    provider.availability !== "request_only" &&
    provider.authMode !== "credential_guide" &&
    provider.capabilities.length > 0 &&
    Boolean(provider.href || provider.nango)
  );
}

export function recommendedIntegrationIds(input: {
  knowledgeLocations: string[];
  selectedTools: string[];
  selectedAiTools: string[];
  goals: string[];
}) {
  const selected = new Set([
    ...input.knowledgeLocations,
    ...input.selectedTools,
    ...input.selectedAiTools,
  ]);
  if (input.goals.includes("ai_tools")) selected.add("chatgpt");
  if (input.goals.includes("learn_calls")) selected.add("twilio");
  return INTEGRATION_CATALOG.filter(
    (provider) => selected.has(provider.id) && isIntegrationReady(provider),
  ).map((provider) => provider.id);
}
