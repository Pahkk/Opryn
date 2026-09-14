import {
  INTEGRATION_CATALOG,
  getIntegrationCatalogItem,
  recommendedIntegrationIds,
  isIntegrationReady,
} from "@/lib/integrations/catalog";

export type ConnectionProviderId = string;

export const CONNECTION_PROVIDERS = INTEGRATION_CATALOG.map((provider) => ({
  ...provider,
  category:
    provider.category === "learn" || provider.category === "business"
      ? ("knowledge" as const)
      : provider.category,
  benefit: provider.permissions.privacy,
  setupType:
    provider.authMode === "native_oauth"
      ? ("oauth" as const)
      : provider.authMode === "credential_guide"
        ? ("credentials" as const)
        : provider.authMode === "mcp"
          ? ("mcp" as const)
          : provider.authMode === "manual"
            ? ("credentials" as const)
            : ("developer" as const),
  supported: isIntegrationReady(provider),
  href: provider.href ?? "/app/integrations",
}));

export function getConnectionProvider(id: string) {
  return getIntegrationCatalogItem(id);
}

export function recommendedProviderIds(input: {
  knowledgeLocations: string[];
  selectedTools: string[];
  selectedAiTools: string[];
  goals: string[];
}) {
  return recommendedIntegrationIds(input);
}
