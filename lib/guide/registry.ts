/** Product help is authored here, not inferred from the DOM or company knowledge. */
export type GuideRole = "owner" | "admin" | "employee";
export type Milestone =
  "source" | "approved" | "answered" | "team" | "connection";
export type SetupFacts = Record<Milestone, boolean | null> & {
  google: boolean | null;
  pending: boolean | null;
};
type Target = {
  route: string;
  title: string;
  description: string;
  admin?: boolean;
  placement?: "top" | "bottom" | "left" | "right";
};
export const guideTargets = {
  "home.overview": {
    route: "/app",
    title: "Your workspace",
    description:
      "Here’s what Opryn handled and what needs your decision. Your first approved knowledge is part of this workspace.",
  },
  "teach.explain": {
    route: "/app/processes/new",
    title: "Teach in your own words",
    description:
      "Teach Opryn whenever your business learns something new. Start with one source or explain a process, then review what it finds.",
    admin: true,
  },
  "teach.search": {
    route: "/app/processes/new",
    title: "Search teaching sources",
    description: "Find a connected source or another way to teach Opryn.",
    admin: true,
  },
  "teach.upload": {
    route: "/app/processes/new",
    title: "Start with a file",
    description:
      "Choose Upload something, then select a supported file. Review the extracted findings before approving them.",
    admin: true,
  },
  "teach.google": {
    route: "/app/processes/new",
    title: "Choose Google files",
    description:
      "Choose Google Workspace. If authorization is needed, complete it here. Then choose the files Opryn should learn from. You stay in Teach.",
    admin: true,
  },
  "teach.notion": {
    route: "/app/processes/new",
    title: "Teach from Notion",
    description:
      "Choose Notion pages or databases here. If Notion is not connected, authorization resumes in Teach.",
    admin: true,
  },
  "teach.confluence": {
    route: "/app/processes/new",
    title: "Teach from Confluence",
    description:
      "Choose Confluence pages or spaces here. Connection management remains under Connections.",
    admin: true,
  },
  "teach.calls": {
    route: "/app/processes/new",
    title: "Teach from a call",
    description:
      "Add an authorized recording and review every finding before approval.",
    admin: true,
  },
  "teach.recent": {
    route: "/app/processes/new",
    title: "Recently learned",
    description:
      "Open recent source activity and continue to its reviewable finding.",
    admin: true,
  },
  "teach.useElsewhere": {
    route: "/app/processes/new",
    title: "Use Opryn elsewhere",
    description:
      "Manage places where approved Opryn knowledge can be used. These are separate from learning sources.",
    admin: true,
  },
  "teach.sources": {
    route: "/app/learning-sources",
    title: "Your learning sources",
    description:
      "Inspect the sources you have brought into Opryn. Connected, imported, and approved are different states.",
    admin: true,
  },
  "knowledge.search": {
    route: "/app/processes",
    title: "Search company knowledge",
    description:
      "Search the knowledge available to you. Open an item to inspect its rule, status, and source.",
  },
  "knowledge.testbench": {
    route: "/app/knowledge/test",
    title: "Test Opryn",
    description:
      "Owners/admins simulate the real Opryn response under an actual member or external connection's permissions. Save expected outcomes and rerun after knowledge changes. Nothing is sent externally.",
    admin: true,
  },
  "knowledge.health": {
    route: "/app/knowledge/health",
    title: "Knowledge Health",
    description:
      "Recorded coverage, gaps, conflicts, review age and selected-source updates. No arbitrary health score.",
    admin: true,
  },
  "knowledge.sourceUpdates": {
    route: "/app/knowledge/health",
    title: "Source Updates",
    description:
      "Check selected Google Workspace, Notion and Confluence content. Updated imports require review; approved knowledge is retained.",
    admin: true,
  },
  "knowledge.analysis": {
    route: "/app/knowledge/analysis",
    title: "Analyze company knowledge",
    description:
      "Choose up to two previously selected sources. New findings require review; analysis never approves knowledge.",
    admin: true,
  },
  "team.learning": {
    route: "/app/training",
    title: "My Learning / Team Learning",
    description:
      "Read assigned approved guidance, acknowledge its current version and practice. Owners assign processes by role or individual; no rankings.",
  },
  "connections.aiAccess": {
    route: "/app/ai-connections",
    title: "AI knowledge access",
    description:
      "Open an actual connection to narrow allowed areas/items, exclusions and unknown routing. Test permissions before relying on them.",
    admin: true,
  },
  "knowledge.categories": {
    route: "/app/processes",
    title: "Find a subject or view",
    description:
      "Use categories and views to narrow the library. On a phone, open the category selector.",
  },
  "knowledge.reviews": {
    route: "/app/processes?view=needs_review",
    title: "Knowledge needing review",
    description:
      "Open a finding to inspect its exact wording and source. Only an authorized person can approve it.",
    admin: true,
  },
  "knowledge.filters": {
    route: "/app/processes",
    title: "Filter knowledge",
    description:
      "Narrow the library by category, status, source, or update date.",
  },
  "knowledge.detail": {
    route: "/app/processes",
    title: "Inspect knowledge details",
    description:
      "Open a row to inspect its source, approval state, version, and lifecycle actions.",
  },
  "knowledge.archive": {
    route: "/app/processes",
    title: "Archive knowledge",
    description:
      "Open a knowledge item, then use Actions. Archive removes it from active retrieval while retaining history and provenance.",
    admin: true,
  },
  "knowledge.delete": {
    route: "/app/processes",
    title: "Delete a draft process",
    description:
      "Open a draft process and use Actions. Approved knowledge must be archived first; permanent deletion is intentionally restricted.",
    admin: true,
  },
  "review.queue": {
    route: "/app/needs-you",
    title: "Make a decision",
    description:
      "Open a pending item. Read the proposal and its source, then accept, edit, or deny it yourself. Guide will never approve for you.",
    admin: true,
  },
  "ask.question": {
    route: "/app/ask",
    title: "Ask a real question",
    description:
      "Ask about a rule you have approved. Opryn uses accessible approved guidance; an unknown answer can be routed for help.",
  },
  "team.invite": {
    route: "/app/team",
    title: "Invite your teammate",
    description:
      "Open Invite Employee. Check the email and access before you send the invitation yourself.",
    admin: true,
  },
  "team.experts": {
    route: "/app/team",
    title: "Assign a knowledge expert",
    description:
      "Choose the person and knowledge area here. Expertise and permission to approve are separate. Review the settings before saving.",
    admin: true,
  },
  "team.roles": {
    route: "/app/team",
    title: "Roles and access",
    description:
      "Open role management to inspect responsibilities and access. Guide cannot grant or remove permissions.",
    admin: true,
  },
  "connections.google": {
    route: "/app/integrations",
    title: "Manage Google Workspace",
    description:
      "Open Google Workspace to connect or manage selected files. To teach from Google without a detour, use Google Workspace in Teach.",
    admin: true,
  },
  "connections.search": {
    route: "/app/integrations",
    title: "Find a connection",
    description:
      "Search tools by name or use. A connection grants a specific capability; it does not mean everything has been learned.",
    admin: true,
  },
  "connections.ai": {
    route: "/app/integrations?filter=ai",
    title: "External AI access",
    description:
      "Manage authorized external AI connections. Available clients and permissions depend on your plan. You confirm any access or credential changes.",
    admin: true,
  },
  "settings.profile": {
    route: "/app/settings/profile",
    title: "Your profile",
    description:
      "Manage your personal identity here. Your workspace role is controlled separately by the workspace owner.",
  },
  "settings.notifications": {
    route: "/app/settings/notifications",
    title: "Your notifications",
    description:
      "Manage the personal delivery options available here. These do not grant permissions or change company approval rules.",
  },
  "settings.integrations": {
    route: "/app/settings/connections",
    title: "Manage connections",
    description:
      "Reconnect, inspect health, or disconnect providers here. Use connected knowledge sources from Teach.",
    admin: true,
  },
  "settings.billing": {
    route: "/app/settings/billing",
    title: "Billing settings",
    description:
      "View the workspace plan and open supported subscription management. Guide never changes billing for you.",
    admin: true,
  },
  "settings.security": {
    route: "/app/settings/data",
    title: "Security and data",
    description:
      "Review available workspace security and data controls. Guide never changes security settings for you.",
    admin: true,
  },
} as const satisfies Record<string, Target>;
export type TargetId = keyof typeof guideTargets;
export const targetIds = Object.keys(guideTargets) as TargetId[];
export function canGuideTarget(id: string, role: GuideRole): id is TargetId {
  if (!Object.hasOwn(guideTargets, id)) return false;
  return (
    !(guideTargets[id as TargetId] as Target).admin ||
    role === "owner" ||
    role === "admin"
  );
}
export function targetSelector(id: TargetId) {
  return `[data-guide="${id}"]`;
}

type GuideDestination = {
  route: string;
  title: string;
  aliases: readonly string[];
  admin?: boolean;
};

/** Deterministic navigation destinations. Guide never turns generated text into a URL. */
export const guideDestinations = [
  {
    route: "/app/knowledge/analysis",
    title: "Analyze company knowledge",
    aliases: [
      "company analysis",
      "analyze company knowledge",
      "analyze my knowledge",
    ],
    admin: true,
  },
  {
    route: "/app/training",
    title: "Learning",
    aliases: ["my learning", "team learning", "role learning"],
  },
  {
    route: "/app/knowledge/health",
    title: "Knowledge Health",
    aliases: ["knowledge health", "source updates", "source freshness"],
    admin: true,
  },
  {
    route: "/app/knowledge/test",
    title: "Test Opryn",
    aliases: ["test opryn", "testbench", "test an answer"],
    admin: true,
  },
  { route: "/app", title: "Home", aliases: ["home", "dashboard"] },
  {
    route: "/app/ask",
    title: "Ask Opryn",
    aliases: ["ask", "ask opryn", "questions"],
  },
  {
    route: "/app/processes/new",
    title: "Teach Opryn",
    aliases: ["teach", "teach opryn", "add knowledge"],
    admin: true,
  },
  {
    route: "/app/processes",
    title: "Knowledge",
    aliases: ["knowledge", "knowledge library", "processes"],
  },
  {
    route: "/app/needs-you",
    title: "Needs You",
    aliases: ["needs you", "review queue", "reviews", "approvals"],
    admin: true,
  },
  { route: "/app/team", title: "Team", aliases: ["team", "people"] },
  {
    route: "/app/integrations",
    title: "Connections",
    aliases: ["connections", "integrations"],
    admin: true,
  },
  {
    route: "/app/settings",
    title: "Settings",
    aliases: ["settings", "preferences"],
  },
  {
    route: "/app/settings/profile",
    title: "Profile",
    aliases: ["profile", "my profile"],
  },
  {
    route: "/app/settings/notifications",
    title: "Notifications",
    aliases: ["notifications", "notification settings"],
  },
  {
    route: "/app/settings/billing",
    title: "Billing",
    aliases: ["billing", "subscription", "plan"],
    admin: true,
  },
  {
    route: "/app/settings/data",
    title: "Security and data",
    aliases: ["security", "security and data", "data settings"],
    admin: true,
  },
  {
    route: "/app/help",
    title: "Help",
    aliases: ["help", "help center"],
  },
] as const satisfies readonly GuideDestination[];

export function resolveGuideDestination(
  prompt: string,
  role: GuideRole,
): GuideDestination | null {
  const navigation = prompt
    .trim()
    .toLowerCase()
    .match(
      /^(?:please\s+)?(?:(?:take|bring|send|navigate)\s+me\s+to|(?:go|open)\s+(?:to\s+)?)\s+(.+?)[.!?]*$/,
    );
  if (!navigation) return null;
  const destination = navigation[1]
    .replace(/\b(?:the|page|screen|section)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const match = (guideDestinations as readonly GuideDestination[]).find(
    (item) =>
      item.aliases.some(
        (alias) => destination === alias || destination.startsWith(`${alias} `),
      ),
  );
  if (!match || (match.admin && role === "employee")) return null;
  return match;
}

export type GuideStep = { targetId: TargetId; milestone?: Milestone };
export const guides = {
  "setup-opryn": {
    title: "Finish setting up Opryn",
    steps: [
      { targetId: "teach.explain", milestone: "source" },
      { targetId: "review.queue", milestone: "approved" },
      { targetId: "ask.question", milestone: "answered" },
    ],
  },
  "teach-first-knowledge": {
    title: "Teach your first knowledge",
    steps: [
      { targetId: "teach.explain", milestone: "source" },
      { targetId: "review.queue", milestone: "approved" },
      { targetId: "ask.question", milestone: "answered" },
    ],
  },
  "connect-google": {
    title: "Teach from Google Workspace",
    steps: [
      { targetId: "teach.google" },
      { targetId: "review.queue", milestone: "approved" },
    ],
  },
  "approve-first-item": {
    title: "Review your first finding",
    steps: [
      { targetId: "review.queue", milestone: "approved" },
      { targetId: "ask.question", milestone: "answered" },
    ],
  },
  "invite-teammate": {
    title: "Invite your team",
    steps: [{ targetId: "team.invite", milestone: "team" }],
  },
  "assign-expert": {
    title: "Assign an expert",
    steps: [{ targetId: "team.experts" }],
  },
  "connect-ai": {
    title: "Connect where you use Opryn",
    steps: [{ targetId: "connections.ai", milestone: "connection" }],
  },
  "find-knowledge": {
    title: "Find company knowledge",
    steps: [
      { targetId: "knowledge.search" },
      { targetId: "knowledge.categories" },
    ],
  },
  "review-needs-you": {
    title: "Work through Needs You",
    steps: [{ targetId: "review.queue" }],
  },
  "product-tour": {
    title: "A quick look around",
    steps: [
      { targetId: "home.overview" },
      { targetId: "teach.explain" },
      { targetId: "ask.question" },
      { targetId: "knowledge.search" },
      { targetId: "review.queue" },
      { targetId: "connections.search" },
    ],
  },
} as const satisfies Record<
  string,
  { title: string; steps: readonly GuideStep[] }
>;
export type GuideId = keyof typeof guides;
export function guideSteps(
  id: GuideId,
  role: GuideRole,
  facts?: SetupFacts,
): GuideStep[] {
  return (guides[id].steps as readonly GuideStep[]).filter(
    (step) =>
      canGuideTarget(step.targetId, role) &&
      !(step.milestone && facts?.[step.milestone] === true),
  );
}
export function pageTargets(path: string, role: GuideRole): TargetId[] {
  if (path === "/app")
    return (
      [
        "teach.explain",
        "knowledge.search",
        "review.queue",
        "ask.question",
      ] as TargetId[]
    ).filter((id) => canGuideTarget(id, role));
  const exact = targetIds.filter(
    (id) =>
      guideTargets[id].route.split("?")[0] === path && canGuideTarget(id, role),
  );
  return exact.length
    ? exact
    : targetIds.filter(
        (id) =>
          [
            "home.overview",
            "knowledge.search",
            "ask.question",
            "settings.profile",
          ].includes(id) && canGuideTarget(id, role),
      );
}
export const milestoneLabels: Record<Milestone, string> = {
  source: "Teach your first source",
  approved: "Approve company knowledge",
  answered: "Get a sourced answer in Ask",
  team: "Invite a teammate",
  connection: "Connect a place to use Opryn",
};
export const productHelp = `Ask Opryn explains the product, setup, settings and integrations, not company policies. Ask Opryn answers company questions from authorized approved knowledge. Teach Opryn is where owners/admins USE connected knowledge sources: choose Google files, Notion pages/databases, or Confluence pages/spaces. Connections is where they MANAGE authorization, health, metadata, reconnection and disconnection. Never route a connected source to Connections when the user wants to teach from it. The core loop is Teach, Review, Approved Knowledge, Ask/Use, unknown questions, Needs You. Sources and imports do not automatically become approved policy. Owners/admins manage teaching, connections and team. Members can search accessible knowledge, ask, and manage their personal settings. Expertise does not automatically confer approval permission. Never ask customers for OAuth secrets or pasted provider IDs. Connecting is not importing; importing is not approving. Archive removes knowledge from active retrieval but retains history and source provenance. Approved knowledge is archived rather than directly hard-deleted. External AI access is permission-controlled retrieval, not agent hosting or fine-tuning. Ask Opryn cannot change billing, permissions, approval, invitations, deletions, security, or credentials. Treat supplied connection status as authoritative and never infer a provider is connected when absent. Plans and provider availability must be inspected in the real UI; never invent prices, limits, enabled providers, or completion. If a feature is not documented in the registered targets, say you cannot confirm it. Never request passwords, tokens, or company documents in Ask Opryn.`;
