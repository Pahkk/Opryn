export type CommunicationProvider = "slack" | "teams";

export type NormalizedChannelMessage = {
  provider: CommunicationProvider;
  externalWorkspaceId: string;
  externalUserId: string;
  conversationId: string;
  threadId: string;
  messageId: string;
  eventId: string;
  text: string;
};

export type ChannelSource = {
  id: string;
  title: string;
  section: string;
  href: string | null;
};

export type ChannelAnswerResult =
  | {
      status: "answered";
      questionId: string;
      headline: string;
      answer: string;
      steps: string[];
      importantNote: string;
      requiresApproval: boolean;
      approvalReason: string;
      sources: ChannelSource[];
    }
  | {
      status: "unknown";
      questionId: string;
      expert: { id: string; name: string } | null;
      related: { content: string; source: ChannelSource | null } | null;
    };

export type ProviderCredentials =
  | { provider: "slack"; botToken: string }
  | { provider: "teams"; tenantId: string; refreshToken?: string };
