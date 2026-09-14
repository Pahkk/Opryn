import "server-only";
import {
  getIntegrationCatalogItem,
  INTEGRATION_CATALOG,
} from "@/lib/integrations/catalog";
import { ConnectionError, nangoEnvironment } from "@/lib/integrations/nango";

// Roll out adapters, not just OAuth providers. Other catalog entries remain request-only.
export function getNangoProvider(provider: string) {
  const entry = getIntegrationCatalogItem(provider);
  if (!entry?.nango || entry.availability === "request_only")
    throw new ConnectionError("This integration is not available yet.", 400);
  nangoEnvironment();
  const integrationId = process.env[entry.nango.integrationIdEnv]?.trim();
  if (!integrationId)
    throw new ConnectionError("This integration is not configured yet.");
  return { ...entry, integrationId };
}

export function configuredNangoProviders() {
  return INTEGRATION_CATALOG.flatMap((provider) => {
    try {
      return [getNangoProvider(provider.id).id];
    } catch {
      return [];
    }
  });
}
