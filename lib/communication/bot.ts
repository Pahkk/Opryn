import "server-only";

import {
  Actions,
  Button,
  Card,
  CardLink,
  CardText,
  Chat,
  LinkButton,
  type Message,
  type Thread,
} from "chat";
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createTeamsAdapter, type TeamsAdapter } from "@chat-adapter/teams";
import { createServiceClient } from "@/lib/supabase/service";
import { SupabaseChatState } from "@/lib/communication/state";
import {
  decryptProviderCredentials,
  createCommunicationToken,
} from "@/lib/communication/crypto";
import { OPRYN_SITE_URL } from "@/lib/communication/config";
import type {
  ChannelAnswerResult,
  CommunicationProvider,
  NormalizedChannelMessage,
} from "@/lib/communication/types";

type CommunicationBot = Chat<{
  slack: SlackAdapter;
  teams: TeamsAdapter;
}>;

const globalBot = globalThis as typeof globalThis & {
  __oprynCommunicationBot?: CommunicationBot;
};

export function getCommunicationBot() {
  if (globalBot.__oprynCommunicationBot)
    return globalBot.__oprynCommunicationBot;

  const slack = createSlackAdapter({
    clientId: process.env.SLACK_CLIENT_ID || "not-configured",
    clientSecret: process.env.SLACK_CLIENT_SECRET || "not-configured",
    signingSecret: process.env.SLACK_SIGNING_SECRET || "not-configured",
    installationProvider: {
      async getInstallation(installationId) {
        const { data } = await createServiceClient()
          .from("communication_integrations")
          .select("external_workspace_name,bot_user_id,encrypted_credentials")
          .eq("provider", "slack")
          .eq("external_workspace_id", installationId)
          .eq("status", "active")
          .maybeSingle();
        if (!data?.encrypted_credentials) return null;
        const credentials = decryptProviderCredentials(
          data.encrypted_credentials,
        );
        if (credentials.provider !== "slack") return null;
        return {
          botToken: credentials.botToken,
          botUserId: data.bot_user_id ?? undefined,
          teamName: data.external_workspace_name,
        };
      },
    },
    nativeStreaming: false,
  });
  const teams = createTeamsAdapter({
    appId:
      process.env.MICROSOFT_CLIENT_ID ||
      process.env.TEAMS_APP_ID ||
      "not-configured",
    appPassword:
      process.env.MICROSOFT_CLIENT_SECRET ||
      process.env.TEAMS_APP_PASSWORD ||
      "not-configured",
    appTenantId:
      process.env.MICROSOFT_TENANT_ID === "common"
        ? undefined
        : process.env.MICROSOFT_TENANT_ID,
    appType: "MultiTenant",
  });

  const bot = new Chat({
    userName: "Opryn",
    adapters: { slack, teams },
    state: new SupabaseChatState(),
    concurrency: "drop",
    dedupeTtlMs: 10 * 60 * 1000,
    logger: process.env.NODE_ENV === "production" ? "warn" : "info",
  });

  bot.onDirectMessage(async (thread, message) => {
    await enqueueIncomingMessage(thread, message);
  });
  bot.onNewMention(async (thread, message) => {
    await thread.subscribe();
    await enqueueIncomingMessage(thread, message);
  });
  bot.onSubscribedMessage(async (thread, message) => {
    await enqueueIncomingMessage(thread, message);
  });
  bot.onSlashCommand("/opryn", async (event) => {
    const thread = await bot.openDM(event.user);
    const normalized = normalizeSlashCommand(
      event.adapter.name,
      event.user.userId,
      thread.id,
      event.text,
      event.raw,
    );
    if (normalized) await persistCommunicationJob(normalized);
    await event.channel.postEphemeral(
      event.user,
      normalized
        ? "I’m checking approved company knowledge and will reply in our direct message."
        : "Opryn couldn’t identify this workspace.",
      { fallbackToDM: true },
    );
  });
  bot.onAction(
    ["opryn_ask_expert", "opryn_helpful", "opryn_not_right"],
    async (event) => {
      const questionId = event.value;
      if (!questionId) return;
      const mapping = await resolveActionUser(
        event.adapter.name,
        event.user.userId,
        event.raw,
      );
      if (!mapping) return;
      if (event.actionId === "opryn_ask_expert") {
        await escalateChannelQuestion(
          mapping.organizationId,
          mapping.userId,
          questionId,
        );
        if (event.thread)
          await event.thread.post(
            "I sent this to the right person. Opryn will notify you when they answer.",
          );
        return;
      }
      await saveChannelFeedback({
        organizationId: mapping.organizationId,
        userId: mapping.userId,
        questionId,
        helpful: event.actionId === "opryn_helpful",
      });
      if (event.thread)
        await event.thread.post(
          event.actionId === "opryn_helpful"
            ? "Thanks — that helps Opryn understand what’s working."
            : "Thanks — I sent this answer to the owner for review.",
        );
    },
  );

  globalBot.__oprynCommunicationBot = bot;
  return bot;
}

async function enqueueIncomingMessage(thread: Thread, message: Message) {
  if (message.author.isMe || message.author.isBot === true) return;
  const normalized = normalizeMessage(thread.adapter.name, thread.id, message);
  if (normalized) await persistCommunicationJob(normalized);
}

function normalizeMessage(
  adapterName: string,
  threadId: string,
  message: Message,
): NormalizedChannelMessage | null {
  if (adapterName !== "slack" && adapterName !== "teams") return null;
  const raw = asRecord(message.raw);
  const workspaceId = providerWorkspaceId(adapterName, raw);
  const text = normalizeQuestionText(adapterName, message.text);
  if (!workspaceId || !message.author.userId || text.length < 2) return null;
  return {
    provider: adapterName,
    externalWorkspaceId: workspaceId,
    externalUserId: message.author.userId,
    conversationId: threadId,
    threadId,
    messageId: message.id,
    eventId:
      stringValue(raw.event_id) ||
      stringValue(raw.id) ||
      `${workspaceId}:${message.id}`,
    text: text.slice(0, 4000),
  };
}

function normalizeQuestionText(provider: CommunicationProvider, value: string) {
  const trimmed = value.trim();
  if (provider !== "slack") return trimmed;
  return trimmed
    .replace(/^\s*<@[A-Z0-9]+>\s*[:,;-]?\s*/i, "")
    .replace(/^\s*@Opryn\b\s*[:,;-]?\s*/i, "")
    .trim();
}

function normalizeSlashCommand(
  adapterName: string,
  userId: string,
  threadId: string,
  text: string,
  rawValue: unknown,
): NormalizedChannelMessage | null {
  if (adapterName !== "slack" || text.trim().length < 2) return null;
  const raw = asRecord(rawValue);
  const workspaceId = providerWorkspaceId("slack", raw);
  const messageId = stringValue(raw.trigger_id) || createCommunicationToken(12);
  if (!workspaceId) return null;
  return {
    provider: "slack",
    externalWorkspaceId: workspaceId,
    externalUserId: userId,
    conversationId: threadId,
    threadId,
    messageId,
    eventId: `${workspaceId}:command:${messageId}`,
    text: text.trim().slice(0, 4000),
  };
}

async function persistCommunicationJob(input: NormalizedChannelMessage) {
  const service = createServiceClient();
  const { data: integration } = await service
    .from("communication_integrations")
    .select("id,organization_id,status,settings")
    .eq("provider", input.provider)
    .eq("external_workspace_id", input.externalWorkspaceId)
    .maybeSingle();
  if (!integration || integration.status !== "active") return;
  const { data: allowed } = await service.rpc(
    "consume_communication_rate_limit",
    {
      target_integration_id: integration.id,
      target_provider_user_id: input.externalUserId,
      minute_limit: 20,
      hour_limit: 300,
    },
  );
  if (!allowed) return;
  const { error } = await service.from("communication_jobs").upsert(
    {
      organization_id: integration.organization_id,
      integration_id: integration.id,
      provider: input.provider,
      provider_event_id: input.eventId,
      provider_workspace_id: input.externalWorkspaceId,
      provider_user_id: input.externalUserId,
      provider_conversation_id: input.conversationId,
      provider_thread_id: input.threadId,
      provider_message_id: input.messageId,
      message_text: input.text,
    },
    { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
  );
  if (error)
    console.error("[Opryn Everywhere] Unable to queue message", {
      provider: input.provider,
      workspaceId: input.externalWorkspaceId,
      code: error.code,
    });
}

export function renderAnswerCard(result: ChannelAnswerResult) {
  if (result.status === "answered") {
    const detail = [
      result.answer,
      result.steps.length
        ? result.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
        : "",
      result.importantNote,
      result.approvalReason,
    ]
      .filter(Boolean)
      .join("\n\n");
    return Card({
      title: result.headline || "Answer",
      subtitle: "Based on approved company knowledge",
      children: [
        CardText(detail),
        ...result.sources.slice(0, 3).map((source) =>
          source.href
            ? CardLink({
                url: `${OPRYN_SITE_URL}${source.href}`,
                label: `Source: ${source.title}${source.section ? ` → ${source.section}` : ""}`,
              })
            : CardText(`Source: ${source.title}`),
        ),
        Actions([
          Button({
            id: "opryn_helpful",
            label: "Helpful",
            value: result.questionId,
          }),
          Button({
            id: "opryn_not_right",
            label: "Not Right",
            value: result.questionId,
          }),
        ]),
      ],
    });
  }
  return Card({
    title: "Opryn doesn’t have an approved answer yet.",
    children: [
      CardText(
        result.related
          ? `Related information:\n${result.related.content}`
          : "I couldn’t find approved company knowledge that answers this.",
      ),
      Actions([
        Button({
          id: "opryn_ask_expert",
          label: result.expert ? `Ask ${result.expert.name}` : "Ask Owner",
          value: result.questionId,
          style: "primary",
        }),
        LinkButton({
          url: `${OPRYN_SITE_URL}/app?question=${result.questionId}#needs-you`,
          label: "Open in Opryn",
        }),
      ]),
    ],
  });
}

export async function postWithIntegrationToken(input: {
  provider: CommunicationProvider;
  integrationId: string;
  threadId: string;
  content: ReturnType<typeof renderAnswerCard> | string;
}) {
  const bot = getCommunicationBot();
  if (input.provider === "teams") {
    return bot.thread(input.threadId).post(input.content);
  }
  const { data } = await createServiceClient()
    .from("communication_integrations")
    .select("external_workspace_id,encrypted_credentials")
    .eq("id", input.integrationId)
    .eq("provider", "slack")
    .maybeSingle();
  if (!data?.encrypted_credentials) throw new Error("Slack is disconnected.");
  const credentials = decryptProviderCredentials(data.encrypted_credentials);
  if (credentials.provider !== "slack")
    throw new Error("Slack is disconnected.");
  const slack = bot.getAdapter("slack") as SlackAdapter;
  return slack.withBotToken(
    credentials.botToken,
    () => bot.thread(input.threadId).post(input.content),
    { installationId: data.external_workspace_id },
  );
}

async function resolveActionUser(
  provider: string,
  externalUserId: string,
  rawValue: unknown,
) {
  if (provider !== "slack" && provider !== "teams") return null;
  const workspaceId = providerWorkspaceId(provider, asRecord(rawValue));
  if (!workspaceId) return null;
  const { data: integration } = await createServiceClient()
    .from("communication_integrations")
    .select("id,organization_id")
    .eq("provider", provider)
    .eq("external_workspace_id", workspaceId)
    .eq("status", "active")
    .maybeSingle();
  if (!integration) return null;
  const { data: mapping } = await createServiceClient()
    .from("communication_user_mappings")
    .select("opryn_user_id")
    .eq("integration_id", integration.id)
    .eq("provider_user_id", externalUserId)
    .maybeSingle();
  return mapping
    ? {
        organizationId: integration.organization_id,
        userId: mapping.opryn_user_id,
      }
    : null;
}

async function escalateChannelQuestion(
  organizationId: string,
  userId: string,
  questionId: string,
) {
  const service = createServiceClient();
  const { data: question } = await service
    .from("employee_questions")
    .select("id,question,assigned_expert_id")
    .eq("id", questionId)
    .eq("organization_id", organizationId)
    .eq("asked_by", userId)
    .maybeSingle();
  if (!question) return;
  await service
    .from("employee_questions")
    .update({ escalated: true })
    .eq("id", question.id);
  const targetIds = question.assigned_expert_id
    ? [question.assigned_expert_id]
    : ((
        await service
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", organizationId)
          .in("permission_level", ["owner", "admin"])
      ).data?.map((item) => item.user_id) ?? []);
  if (targetIds.length)
    await service.from("notifications").insert(
      targetIds.map((targetId) => ({
        organization_id: organizationId,
        user_id: targetId,
        type: question.assigned_expert_id
          ? "expert_question"
          : "owner_question",
        title: "Opryn needs your help",
        body: question.question,
        link: `/app?question=${questionId}#needs-you`,
        entity_type: "question",
        entity_id: questionId,
        action: "answer",
        target_url: `/app?question=${questionId}#needs-you`,
      })),
    );
}

async function saveChannelFeedback(input: {
  organizationId: string;
  userId: string;
  questionId: string;
  helpful: boolean;
}) {
  const service = createServiceClient();
  const { data: question } = await service
    .from("employee_questions")
    .select("id")
    .eq("id", input.questionId)
    .eq("organization_id", input.organizationId)
    .eq("asked_by", input.userId)
    .maybeSingle();
  if (!question) return;
  const { data: source } = await service
    .from("question_sources")
    .select("knowledge_chunk_id")
    .eq("question_id", question.id)
    .order("similarity", { ascending: false })
    .limit(1)
    .maybeSingle();
  await service.from("knowledge_feedback").upsert(
    {
      organization_id: input.organizationId,
      knowledge_chunk_id: source?.knowledge_chunk_id ?? null,
      question_id: question.id,
      user_id: input.userId,
      feedback_type: input.helpful ? "helpful" : "not_right",
      reason: input.helpful ? null : "didnt_answer",
      status: "open",
    },
    { onConflict: "question_id,user_id" },
  );
}

function providerWorkspaceId(
  provider: CommunicationProvider,
  raw: Record<string, unknown>,
) {
  if (provider === "slack")
    return (
      stringValue(raw.team_id) ||
      stringValue(raw.team) ||
      stringValue(asRecord(raw.enterprise).id)
    );
  const conversation = asRecord(raw.conversation);
  const channelData = asRecord(raw.channelData);
  return (
    stringValue(conversation.tenantId) ||
    stringValue(asRecord(channelData.tenant).id) ||
    stringValue(channelData.tenantId)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
