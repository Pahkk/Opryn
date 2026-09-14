import type { IntegrationCatalogItem } from "@/lib/integrations/types";

export type CredentialField = {
  key: string;
  label: string;
  type?: "text" | "password" | "url" | "email" | "textarea" | "select";
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: readonly { value: string; label: string }[];
};

export type CredentialGuide = {
  providerId: string;
  title: string;
  intro: string;
  portalLabel: string;
  portalUrl: string;
  steps: readonly string[];
  fields: readonly CredentialField[];
};

const tokenField = (label = "API token"): CredentialField => ({
  key: "apiToken",
  label,
  type: "password",
  placeholder: "Paste securely",
  required: true,
  help: "Stored encrypted. Opryn never shows the full value again.",
});

const guides: Record<string, CredentialGuide> = {
  github: {
    providerId: "github",
    title: "Connect GitHub",
    intro:
      "Create a read-only fine-grained token for the repositories Opryn may learn from.",
    portalLabel: "Open GitHub tokens",
    portalUrl: "https://github.com/settings/personal-access-tokens/new",
    steps: [
      "Create a fine-grained personal access token.",
      "Choose only the repositories Opryn should be allowed to read.",
      "Grant read-only access to repository contents and metadata.",
      "Copy the token and paste it below.",
    ],
    fields: [tokenField("Fine-grained access token")],
  },
  notion: {
    providerId: "notion",
    title: "Connect Notion",
    intro:
      "Create an internal Notion integration, then share only the pages Opryn should use.",
    portalLabel: "Open Notion integrations",
    portalUrl: "https://www.notion.so/profile/integrations",
    steps: [
      "Create a new internal integration named Opryn.",
      "Copy its internal integration secret.",
      "Open each page Opryn may use and add the Opryn integration under Connections.",
      "Paste the secret below.",
    ],
    fields: [tokenField("Internal integration secret")],
  },
  hubspot: {
    providerId: "hubspot",
    title: "Connect HubSpot",
    intro:
      "Use a HubSpot private app so your business controls exactly what Opryn can read.",
    portalLabel: "Open HubSpot private apps",
    portalUrl: "https://app.hubspot.com/private-apps/",
    steps: [
      "Create a private app named Opryn.",
      "Choose only the read scopes needed for the information you want to use.",
      "Create the app and reveal its access token.",
      "Paste the token below.",
    ],
    fields: [tokenField("Private app access token")],
  },
  google_drive: googleServiceGuide("Google Drive", "files"),
  google_docs: googleServiceGuide("Google Docs", "documents"),
  gmail: googleServiceGuide("Gmail", "mailbox"),
  confluence: {
    providerId: "confluence",
    title: "Connect Confluence",
    intro:
      "Use an Atlassian API token with your business email and Confluence address.",
    portalLabel: "Create Atlassian API token",
    portalUrl: "https://id.atlassian.com/manage-profile/security/api-tokens",
    steps: [
      "Create an Atlassian API token named Opryn.",
      "Copy your Confluence site address and account email.",
      "Paste the three values below.",
    ],
    fields: [
      {
        key: "baseUrl",
        label: "Confluence site URL",
        type: "url",
        placeholder: "https://company.atlassian.net",
        required: true,
      },
      { key: "email", label: "Atlassian email", type: "email", required: true },
      tokenField(),
    ],
  },
  sharepoint: microsoftAppGuide("SharePoint"),
  teams: microsoftAppGuide("Microsoft Teams"),
  salesforce: {
    providerId: "salesforce",
    title: "Connect Salesforce",
    intro:
      "Add an access token for the Salesforce organization Opryn should use.",
    portalLabel: "Open Salesforce setup",
    portalUrl: "https://login.salesforce.com/",
    steps: [
      "Create or choose a read-only connected app.",
      "Generate an access token for the intended organization.",
      "Paste the instance URL and token below.",
    ],
    fields: [
      {
        key: "instanceUrl",
        label: "Instance URL",
        type: "url",
        placeholder: "https://company.my.salesforce.com",
        required: true,
      },
      tokenField("Access token"),
    ],
  },
  pipedrive: {
    providerId: "pipedrive",
    title: "Connect Pipedrive",
    intro: "Use the personal API token from your Pipedrive account.",
    portalLabel: "Open Pipedrive settings",
    portalUrl: "https://app.pipedrive.com/settings/api",
    steps: [
      "Open Personal preferences, then API.",
      "Copy your personal API token.",
      "Enter your company domain and token below.",
    ],
    fields: [
      {
        key: "companyDomain",
        label: "Company domain",
        placeholder: "acme",
        required: true,
        help: "The part before .pipedrive.com",
      },
      tokenField(),
    ],
  },
  shopify: {
    providerId: "shopify",
    title: "Connect Shopify",
    intro: "Create a custom app with read-only Admin API access.",
    portalLabel: "Open Shopify admin",
    portalUrl: "https://admin.shopify.com/",
    steps: [
      "Open Settings → Apps and sales channels → Develop apps.",
      "Create an app named Opryn and choose only required read scopes.",
      "Install it, reveal the Admin API token, and paste it below.",
    ],
    fields: [
      {
        key: "shopDomain",
        label: "Shop domain",
        placeholder: "store.myshopify.com",
        required: true,
      },
      tokenField("Admin API access token"),
    ],
  },
  quickbooks: {
    providerId: "quickbooks",
    title: "Connect QuickBooks",
    intro:
      "QuickBooks requires an Intuit app and a renewable authorization token.",
    portalLabel: "Open Intuit Developer",
    portalUrl: "https://developer.intuit.com/app/developer/dashboard",
    steps: [
      "Create an Intuit app for QuickBooks Online.",
      "Authorize it for your company with read access.",
      "Copy the company ID and current refresh token.",
      "Paste the values below. Opryn will store them encrypted.",
    ],
    fields: [
      { key: "realmId", label: "QuickBooks company ID", required: true },
      { key: "clientId", label: "Client ID", required: true },
      {
        key: "clientSecret",
        label: "Client secret",
        type: "password",
        required: true,
      },
      {
        key: "refreshToken",
        label: "Refresh token",
        type: "password",
        required: true,
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        required: true,
        options: [
          { value: "production", label: "Production" },
          { value: "sandbox", label: "Sandbox" },
        ],
      },
    ],
  },
};

function googleServiceGuide(name: string, noun: string): CredentialGuide {
  return {
    providerId: name.toLowerCase().replace(/\s+/g, "_"),
    title: `Connect ${name}`,
    intro: `Use a Google service account and share only the ${noun} Opryn may access.`,
    portalLabel: "Open Google Cloud credentials",
    portalUrl: "https://console.cloud.google.com/apis/credentials",
    steps: [
      "Create or choose a Google Cloud project for Opryn.",
      "Enable the required Google API and create a service account.",
      "Create a JSON key for that service account.",
      `Share only the ${noun} Opryn may use with the service account email, then paste the JSON key below.`,
    ],
    fields: [
      {
        key: "serviceAccountJson",
        label: "Service account JSON",
        type: "textarea",
        placeholder: "Paste the full JSON key",
        required: true,
      },
      {
        key: "delegatedEmail",
        label: "Workspace user to access",
        type: "email",
        help: "Optional. Required only for domain-wide delegation.",
      },
    ],
  };
}

function microsoftAppGuide(name: string): CredentialGuide {
  return {
    providerId: name.toLowerCase().replace(/\s+/g, "_"),
    title: `Connect ${name}`,
    intro: `Use a Microsoft Entra application owned by your business for ${name} access.`,
    portalLabel: "Open Microsoft Entra",
    portalUrl:
      "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    steps: [
      "Register an application named Opryn.",
      "Add the minimum read-only Microsoft Graph permissions you need.",
      "Create a client secret.",
      "Paste the tenant and application values below.",
    ],
    fields: [
      { key: "tenantId", label: "Tenant ID", required: true },
      { key: "clientId", label: "Client ID", required: true },
      {
        key: "clientSecret",
        label: "Client secret",
        type: "password",
        required: true,
      },
    ],
  };
}

export function getCredentialGuide(
  provider: Pick<IntegrationCatalogItem, "id" | "name">,
): CredentialGuide {
  return (
    guides[provider.id] ?? {
      providerId: provider.id,
      title: `Connect ${provider.name}`,
      intro: `Add a restricted API credential created specifically for Opryn.`,
      portalLabel: `Open ${provider.name}`,
      portalUrl: providerPortal(provider.id),
      steps: [
        `Open ${provider.name} account or developer settings.`,
        "Create a read-only API key or personal access token named Opryn.",
        "Limit it to the information Opryn should be able to use.",
        "Paste the credential below.",
      ],
      fields: [
        {
          key: "baseUrl",
          label: "Account or API URL",
          type: "url",
          help: "Optional unless your software uses a company-specific URL.",
        },
        tokenField(),
      ],
    }
  );
}

function providerPortal(id: string) {
  const safe = id.replace(/_/g, "-");
  return `https://www.google.com/search?q=${encodeURIComponent(`${safe} create API token`)}`;
}
