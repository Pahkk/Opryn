export type SetupItem = {
  label: string;
  complete: boolean;
  href: string;
  optional?: boolean;
};

export function buildSetupChecklist(progress: {
  hasApprovedKnowledge: boolean;
  hasSuccessfulAnswer: boolean;
  hasAiConnection: boolean;
  teamInvited: boolean;
}): SetupItem[] {
  return [
    {
      label: "Teach and test your first answer",
      complete: progress.hasApprovedKnowledge && progress.hasSuccessfulAnswer,
      href: progress.hasApprovedKnowledge
        ? "/app/ask"
        : "/onboarding?step=teach",
    },
    {
      label: "Connect AI",
      complete: progress.hasAiConnection,
      href: "/app/integrations?filter=ai",
    },
    {
      label: "Invite your team",
      complete: progress.teamInvited,
      href: "/app/team",
      optional: true,
    },
  ];
}

export function setupChecklistProgress(items: SetupItem[]) {
  const required = items.filter((item) => !item.optional);
  return {
    completed: required.filter((item) => item.complete).length,
    total: required.length,
  };
}
