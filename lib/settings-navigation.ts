export const SETTINGS_SECTIONS = [
  {
    id: "profile",
    title: "My Profile",
    group: "account",
    description: "Your name, photo, and current membership.",
    keywords: "change name avatar picture account email job title",
  },
  {
    id: "preferences",
    title: "Preferences",
    group: "account",
    description: "How Opryn looks and formats information for you.",
    keywords: "timezone locale date time density compact motion accessibility",
  },
  {
    id: "notifications",
    title: "Notifications",
    group: "account",
    description: "Choose your personal in-app reminders.",
    keywords: "stop emails alerts notifications questions approval training",
  },
  {
    id: "security",
    title: "Sign-in & Security",
    group: "account",
    description: "Your sign-in methods and session controls.",
    keywords: "password email login sign out sessions two factor mfa",
  },
  {
    id: "general",
    title: "General",
    group: "workspace",
    description: "Your business details and workspace identity.",
    keywords: "business company name logo description timezone slug owner",
  },
  {
    id: "members",
    title: "Members & Access",
    group: "workspace",
    description: "Manage invitations, roles, and expertise.",
    keywords: "invite employee remove member permissions team expertise",
  },
  {
    id: "company",
    title: "Company Profile",
    group: "workspace",
    description: "The company context you supplied during setup.",
    keywords: "business company website departments knowledge areas onboarding",
  },
  {
    id: "knowledge",
    title: "Knowledge & Approvals",
    group: "workspace",
    description: "How information becomes official company guidance.",
    keywords:
      "approval permissions confidence expert owner questions escalations",
  },
  {
    id: "connections",
    title: "Connections & AI Access",
    group: "workspace",
    description: "Manage sources and authorized people and AI tools.",
    keywords: "disconnect Google Slack drive mcp api agents tokens access",
  },
  {
    id: "billing",
    title: "Billing & Usage",
    group: "workspace",
    description: "Your plan, employee seats, invoices, and payments.",
    keywords:
      "cancel subscription upgrade downgrade payment invoice pricing trial",
  },
  {
    id: "data",
    title: "Security & Data",
    group: "workspace",
    description: "Understand source handling and workspace removal.",
    keywords:
      "delete workspace export retention recordings data security privacy",
  },
  {
    id: "activity",
    title: "Activity Log",
    group: "workspace",
    description: "Recent recorded knowledge and workspace changes.",
    keywords: "audit history changes who activity log",
  },
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];
export function settingsSections(isAdmin: boolean) {
  return SETTINGS_SECTIONS.filter(
    (item) => item.group === "account" || isAdmin,
  );
}
export function searchSettings(query: string, isAdmin: boolean) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return settingsSections(isAdmin).filter((item) =>
    words.every((word) =>
      `${item.title} ${item.description} ${item.keywords}`
        .toLowerCase()
        .includes(word),
    ),
  );
}
