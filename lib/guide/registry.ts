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
      "See what Opryn handled and what needs a person. Setup progress reflects saved activity, not tour clicks.",
  },
  "teach.explain": {
    route: "/app/processes/new",
    title: "Teach in your own words",
    description:
      "Explain one process or rule. Opryn prepares findings for review; teaching does not automatically publish company policy.",
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
      { targetId: "knowledge.search" },
      { targetId: "review.queue" },
      { targetId: "team.invite" },
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
export const productHelp = `Opryn Guide explains the product, not company policies. Ask Opryn answers company questions from authorized approved knowledge. The core loop is Teach, Review, Approved Knowledge, Ask/Use, unknown questions, Needs You. Sources and imports do not automatically become approved policy. Owners/admins manage teaching, connections and team. Members can search accessible knowledge, ask, and manage their personal settings. Expertise does not automatically confer approval permission. Google in Teach uses selected Docs, Sheets and Slides through existing OAuth and Picker; never ask customers for OAuth secrets or pasted file IDs. Connecting is not importing; importing is not approving. External AI access is permission-controlled retrieval, not agent hosting or fine-tuning. Guide cannot change billing, permissions, approval, invitations, deletions, security, or credentials. Plans and provider availability must be inspected in the real UI; never invent prices, limits, enabled providers, or completion. If a feature is not documented in the registered targets, say you cannot confirm it and suggest Help. Never request passwords, tokens, or company documents in Guide.`;
