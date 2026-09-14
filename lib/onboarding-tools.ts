export type BusinessTool = readonly [
  id: string,
  name: string,
  category: string,
];

export const BUSINESS_TOOLS = [
  ["slack", "Slack", "Communication"],
  ["teams", "Microsoft Teams", "Communication"],
  ["google_chat", "Google Chat", "Communication"],
  ["discord", "Discord", "Communication"],
  ["gmail", "Gmail", "Email"],
  ["outlook", "Outlook", "Email"],
  ["zoom", "Zoom", "Meetings"],
  ["google_workspace", "Google Workspace", "Work & documents"],
  ["microsoft_365", "Microsoft 365", "Work & documents"],
  ["google_drive", "Google Drive", "Knowledge"],
  ["google_docs", "Google Docs", "Knowledge"],
  ["notion", "Notion", "Knowledge"],
  ["dropbox", "Dropbox", "Knowledge"],
  ["box", "Box", "Knowledge"],
  ["onedrive", "OneDrive", "Knowledge"],
  ["sharepoint", "SharePoint", "Knowledge"],
  ["confluence", "Confluence", "Knowledge"],
  ["github", "GitHub", "Software development"],
  ["gitlab", "GitLab", "Software development"],
  ["bitbucket", "Bitbucket", "Software development"],
  ["jira", "Jira", "Project management"],
  ["linear", "Linear", "Project management"],
  ["asana", "Asana", "Project management"],
  ["trello", "Trello", "Project management"],
  ["clickup", "ClickUp", "Project management"],
  ["monday", "monday.com", "Project management"],
  ["basecamp", "Basecamp", "Project management"],
  ["figma", "Figma", "Design"],
  ["canva", "Canva", "Design"],
  ["adobe", "Adobe Creative Cloud", "Design"],
  ["quickbooks", "QuickBooks", "Accounting"],
  ["xero", "Xero", "Accounting"],
  ["freshbooks", "FreshBooks", "Accounting"],
  ["stripe", "Stripe", "Payments"],
  ["square", "Square", "Payments"],
  ["shopify", "Shopify", "Commerce"],
  ["hubspot", "HubSpot", "Sales & customers"],
  ["salesforce", "Salesforce", "Sales & customers"],
  ["zendesk", "Zendesk", "Customer support"],
  ["intercom", "Intercom", "Customer support"],
  ["mailchimp", "Mailchimp", "Marketing"],
  ["constant_contact", "Constant Contact", "Marketing"],
  ["calendly", "Calendly", "Scheduling"],
  ["loom", "Loom", "How-to video"],
  ["jobber", "Jobber", "Field service"],
  ["servicetitan", "ServiceTitan", "Field service"],
  ["housecall_pro", "Housecall Pro", "Field service"],
  ["procore", "Procore", "Construction"],
  ["buildertrend", "Buildertrend", "Construction"],
  ["twilio", "Twilio", "Phone & messaging"],
  ["aircall", "Aircall", "Phone & calls"],
  ["ringcentral", "RingCentral", "Phone & calls"],
  ["dialpad", "Dialpad", "Phone & calls"],
  ["zoom_phone", "Zoom Phone", "Phone & calls"],
  ["zapier", "Zapier", "Automation"],
  ["make", "Make", "Automation"],
  ["n8n", "n8n", "Automation"],
] as const satisfies readonly BusinessTool[];

export const POPULAR_BUSINESS_TOOL_IDS = [
  "slack",
  "google_workspace",
  "google_drive",
  "teams",
  "github",
  "notion",
  "quickbooks",
  "hubspot",
] as const;

const TOOL_ALIASES: Record<string, string[]> = {
  github: ["git", "code repository", "software development", "source code"],
  google_workspace: ["gsuite", "g suite", "google business"],
  microsoft_365: ["office", "office 365", "m365"],
  quickbooks: ["bookkeeping", "accounting", "invoices"],
  servicetitan: ["service titan", "field service", "hvac software"],
  housecall_pro: ["housecall", "house call pro", "field service"],
  monday: ["monday", "monday com"],
  make: ["make.com", "integromat"],
};

export function searchBusinessTools(query: string, limit = 16) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return BUSINESS_TOOLS.map((tool) => {
    const [id, name, category] = tool;
    const haystack =
      `${id} ${name} ${category} ${(TOOL_ALIASES[id] ?? []).join(" ")}`.toLowerCase();
    const score = terms.reduce((total, term) => {
      if (name.toLowerCase() === term || id === term) return total + 12;
      if (name.toLowerCase().startsWith(term)) return total + 7;
      if (haystack.includes(term)) return total + 3;
      return total;
    }, 0);
    return { tool, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.tool[1].localeCompare(b.tool[1]))
    .slice(0, limit)
    .map(({ tool }) => tool);
}
