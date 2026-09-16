import {
  IntegrationsCatalog,
  type IntegrationConnectionView,
} from "@/components/app/integrations-catalog";
import { AIConnectionsList } from "@/components/app/ai-connections";
import { McpConnections } from "@/components/app/mcp-connections";
import { requireAdminContext } from "@/lib/app-context";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import {
  INTEGRATION_CATALOG,
  recommendedIntegrationIds,
} from "@/lib/integrations/catalog";
import type { IntegrationCatalogItem } from "@/lib/integrations/types";
import { createClient } from "@/lib/supabase/server";
import { configuredNangoProviders } from "@/lib/integrations/nango-providers";
import { safeAppReturnPath } from "@/lib/return-path";

type ConnectionStatus = Omit<IntegrationConnectionView, "providerId">;

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    focus?: string;
    filter?: string;
    provider?: string;
    returnTo?: string;
  }>;
}) {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization.id;
  const query = await searchParams;
  const returnTo = safeAppReturnPath(query.returnTo, "/app/integrations");
  const [
    plan,
    onboarding,
    communication,
    twilio,
    mcp,
    credentialResult,
    aiConnectionResult,
  ] = await Promise.all([
    getOrganizationPlan(supabase, organizationId),
    supabase
      .from("organization_onboarding")
      .select(
        "selected_goals,knowledge_locations,selected_tools,selected_ai_tools",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("communication_integrations")
      .select("provider,status,external_workspace_name,last_used_at,updated_at")
      .eq("organization_id", organizationId)
      .neq("status", "disconnected"),
    supabase
      .from("phone_integrations")
      .select("status,updated_at")
      .eq("organization_id", organizationId)
      .eq("provider", "twilio")
      .maybeSingle(),
    supabase
      .from("mcp_oauth_grants")
      .select(
        "id,client_kind,scopes,last_used_at,authorized_at,user_id,mcp_oauth_clients(client_name),profiles!mcp_oauth_grants_user_id_fkey(full_name,email)",
      )
      .eq("organization_id", organizationId)
      .is("revoked_at", null),
    supabase
      .from("integrations")
      .select(
        "id,provider,status,auth_platform,error_code,external_account_name,last_used_at,last_sync_at,updated_at",
      )
      .eq("organization_id", organizationId)
      .or("status.neq.disconnected,error_code.eq.disconnect_pending"),
    supabase
      .from("external_ai_connections")
      .select("id,name,provider,description,status,last_used_at,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  if (
    credentialResult.error ||
    communication.error ||
    twilio.error ||
    mcp.error ||
    aiConnectionResult.error
  )
    throw new Error("Your connections could not be loaded. Please retry.");
  const credentialRows = credentialResult.data ?? [];
  const statuses = new Map<string, ConnectionStatus>();
  for (const row of credentialRows) {
    statuses.set(row.provider, {
      id: row.id,
      nango: row.auth_platform === "nango",
      connected: row.auth_platform === "nango" && row.status === "connected",
      setupOnly: row.auth_platform !== "nango",
      needsAttention:
        row.status === "needs_reauthorization" ||
        row.status === "error" ||
        row.error_code === "disconnect_pending",
      detail:
        row.auth_platform === "nango"
          ? `Connected to ${context.organization.name}. Import files separately.`
          : "Setup details saved. Provider access and a working workflow are not verified.",
      lastUsed: row.last_sync_at ?? row.last_used_at ?? row.updated_at,
    });
  }

  const communicationRows = communication.data ?? [];
  for (const provider of ["slack", "teams"]) {
    const row = communicationRows.find((item) => item.provider === provider);
    if (!row && statuses.has(provider)) continue;
    statuses.set(provider, {
      connected: row?.status === "active",
      needsAttention: row?.status === "error",
      detail: row?.external_workspace_name ?? undefined,
      lastUsed: row?.last_used_at ?? row?.updated_at,
    });
  }

  statuses.set("twilio", {
    connected: twilio.data?.status === "active",
    needsAttention: twilio.data?.status === "error",
    lastUsed: twilio.data?.updated_at,
  });
  for (const [id, kind] of [
    ["chatgpt", "chatgpt"],
    ["claude", "claude"],
    ["custom_agent", "custom_mcp"],
  ] as const) {
    const grant = mcp.data?.find((item) => item.client_kind === kind);
    statuses.set(id, {
      connected: Boolean(grant),
      authorizationOnly: Boolean(grant),
      detail: grant
        ? grant.last_used_at
          ? "Opryn access used. Test a question to check the answer."
          : "Access authorized. Ask a question to test it."
        : undefined,
      lastUsed: grant?.last_used_at,
    });
  }

  const customProviders = credentialRows
    .filter((row) => row.provider.startsWith("custom_"))
    .map(customCatalogItem);
  const aiConnectionProviders = (aiConnectionResult.data ?? []).map(
    aiConnectionCatalogItem,
  );
  for (const row of aiConnectionResult.data ?? []) {
    statuses.set(`ai_connection_${row.id}`, {
      id: row.id,
      connected: row.status === "active",
      authorizationOnly: row.status === "active",
      needsAttention: false,
      detail: row.last_used_at
        ? "Opryn access used. Test a question to check the answer."
        : "Access credential created. Test from your AI tool to verify the connection.",
      lastUsed: row.last_used_at,
    });
  }
  const nangoProviders = configuredNangoProviders();
  const providers = [
    ...INTEGRATION_CATALOG.map((provider) =>
      nangoProviders.includes(provider.id)
        ? {
            ...provider,
            description:
              provider.nango?.adapter === "notion"
                ? "Choose authorized Notion pages Opryn can learn from."
                : "Choose authorized files Opryn can learn from.",
          }
        : provider,
    ),
    ...aiConnectionProviders,
    ...customProviders,
  ];
  const selected = onboarding.data;
  const personalizedIds = selected
    ? recommendedIntegrationIds({
        goals: selected.selected_goals,
        knowledgeLocations: selected.knowledge_locations,
        selectedTools: selected.selected_tools,
        selectedAiTools: selected.selected_ai_tools,
      })
    : [];
  const recommendedIds = [
    ...personalizedIds,
    "google_drive",
    "notion",
    "slack",
    "chatgpt",
    "twilio",
  ].filter((id, index, all) => all.indexOf(id) === index);
  const connections: IntegrationConnectionView[] = Array.from(
    statuses,
    ([providerId, status]) => ({ providerId, ...status }),
  );
  const mcpGrants = (mcp.data ?? []).map((row) => {
    const rawClient = row.mcp_oauth_clients as unknown;
    const client = (Array.isArray(rawClient) ? rawClient[0] : rawClient) as {
      client_name: string;
    } | null;
    const rawProfile = row.profiles as unknown;
    const profile = (
      Array.isArray(rawProfile) ? rawProfile[0] : rawProfile
    ) as { full_name: string | null; email: string } | null;
    return {
      id: row.id,
      clientKind: row.client_kind,
      clientName: client?.client_name || "MCP client",
      userName: profile?.full_name || profile?.email || "Team member",
      scopes: row.scopes,
      lastUsedAt: row.last_used_at,
      authorizedAt: row.authorized_at,
    };
  });
  const hasManagedAiConnections =
    mcpGrants.length > 0 || (aiConnectionResult.data?.length ?? 0) > 0;

  return (
    <>
      <IntegrationsCatalog
        organizationId={organizationId}
        organizationName={context.organization.name}
        nangoProviders={nangoProviders}
        providers={providers}
        connections={connections}
        recommendedIds={recommendedIds}
        plan={plan.plan}
        autoFocus={query.focus === "search"}
        initialFilter={query.filter === "ai" ? "ai" : "all"}
        initialProviderId={query.provider}
        returnTo={returnTo}
      />
      {hasManagedAiConnections ? (
        <section id="ai-access" className="mt-12 scroll-mt-24">
          <div className="mb-5 border-b border-[var(--opryn-line)] pb-5">
            <p className="opryn-section-label text-[var(--opryn-blue)]">
              AI ACCESS
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-.035em] text-[var(--opryn-navy)]">
              Manage connected AI
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--opryn-muted)]">
              Review access, activity, and authorization for tools already
              connected to Opryn.
            </p>
          </div>
          {mcpGrants.length ? (
            <McpConnections
              grants={mcpGrants as never[]}
              enabled={plan.plan === "premium"}
            />
          ) : null}
          {(aiConnectionResult.data?.length ?? 0) > 0 ? (
            <div>
              <h3 className="mb-3 text-base font-semibold text-[var(--opryn-navy)]">
                Custom agents
              </h3>
              <AIConnectionsList
                connections={(aiConnectionResult.data ?? []) as never[]}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function aiConnectionCatalogItem(row: {
  id: string;
  name: string;
  provider: string;
  description: string | null;
}): IntegrationCatalogItem {
  return {
    id: `ai_connection_${row.id}`,
    name: row.name,
    category: "ai",
    authMode: "api_key_advanced",
    capabilities: ["ai_knowledge_access"],
    aliases: [row.provider, "agent", "api", "mcp"],
    description:
      row.description || "External AI agent using approved Opryn knowledge.",
    setupTime: "Connected AI agent",
    premium: true,
    href: `/app/ai-connections/${row.id}`,
    permissions: {
      can: [
        "Use the approved knowledge assigned to this connection",
        "Request guidance through Opryn when allowed",
      ],
      cannot: [
        "Access another organization",
        "Bypass Opryn knowledge permissions",
      ],
      privacy:
        "This agent receives only the Opryn knowledge and capabilities assigned to its connection.",
    },
  };
}

function customCatalogItem(row: {
  provider: string;
  external_account_name: string | null;
}): IntegrationCatalogItem {
  const fallbackName = row.provider
    .slice(7)
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  const name = row.external_account_name || fallbackName || "Custom software";
  return {
    id: row.provider,
    name,
    category: "business",
    authMode: "credential_guide",
    capabilities: [],
    aliases: ["custom", "business"],
    description: `Owner-managed connection for ${name}.`,
    setupTime: "Guided setup",
    premium: false,
    permissions: {
      can: ["Use only the credential you provide"],
      cannot: ["Change company policy", "Access another Opryn organization"],
      privacy: "Credentials are encrypted and scoped to this business.",
    },
  };
}
