import "server-only";

import { Card, CardText, LinkButton, Actions } from "chat";
import { createServiceClient } from "@/lib/supabase/service";
import {
  answerCommunicationQuestion,
  ChannelPermissionError,
} from "@/lib/communication/answer";
import {
  postWithIntegrationToken,
  renderAnswerCard,
} from "@/lib/communication/bot";
import {
  createCommunicationToken,
  hashCommunicationToken,
} from "@/lib/communication/crypto";
import { OPRYN_SITE_URL } from "@/lib/communication/config";
import type { CommunicationProvider } from "@/lib/communication/types";
import { hasFeature } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";

type Job = {
  id: string;
  organization_id: string;
  integration_id: string;
  provider: CommunicationProvider;
  provider_user_id: string;
  provider_conversation_id: string;
  provider_thread_id: string;
  provider_message_id: string;
  message_text: string;
  attempt_count: number;
};

export async function processPendingCommunicationJobs(limit = 12) {
  const service = createServiceClient();
  const { data: jobs, error } = await service
    .from("communication_jobs")
    .select(
      "id,organization_id,integration_id,provider,provider_user_id,provider_conversation_id,provider_thread_id,provider_message_id,message_text,attempt_count",
    )
    .in("status", ["queued", "failed"])
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempt_count", 5)
    .order("created_at")
    .limit(limit);
  if (error) throw error;
  let processed = 0;
  for (const job of (jobs ?? []) as Job[]) {
    const { data: claimed } = await service
      .from("communication_jobs")
      .update({ status: "processing", attempt_count: job.attempt_count + 1 })
      .eq("id", job.id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      await processCommunicationJob(job);
      await service
        .from("communication_jobs")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", job.id);
      processed += 1;
    } catch (caught) {
      const attempt = job.attempt_count + 1;
      const final = attempt >= 5 || caught instanceof ChannelPermissionError;
      await service
        .from("communication_jobs")
        .update({
          status: final ? "failed" : "queued",
          next_attempt_at: new Date(
            Date.now() + Math.min(30, 2 ** attempt) * 60_000,
          ).toISOString(),
          error_message:
            caught instanceof Error
              ? caught.message.slice(0, 500)
              : "Unknown error",
        })
        .eq("id", job.id);
      if (caught instanceof ChannelPermissionError)
        await postWithIntegrationToken({
          provider: job.provider,
          integrationId: job.integration_id,
          threadId: job.provider_thread_id,
          content: caught.message,
        });
      console.error("[Opryn Everywhere] Message processing failed", {
        jobId: job.id,
        provider: job.provider,
        attempt,
        final,
      });
    }
  }
  return processed;
}

async function processCommunicationJob(job: Job) {
  const service = createServiceClient();
  const [{ data: integration }, { data: mapping }] = await Promise.all([
    service
      .from("communication_integrations")
      .select("id,organization_id,status,settings")
      .eq("id", job.integration_id)
      .eq("organization_id", job.organization_id)
      .eq("provider", job.provider)
      .maybeSingle(),
    service
      .from("communication_user_mappings")
      .select("opryn_user_id")
      .eq("integration_id", job.integration_id)
      .eq("provider_user_id", job.provider_user_id)
      .maybeSingle(),
  ]);
  if (!integration || integration.status !== "active")
    throw new ChannelPermissionError("This Opryn connection is paused.");
  const subscription = await getOrganizationPlan(service, job.organization_id);
  const feature =
    job.provider === "slack" ? "slackIntegration" : "teamsIntegration";
  if (!hasFeature(subscription.plan, feature))
    throw new ChannelPermissionError(
      `${job.provider === "slack" ? "Slack" : "Microsoft Teams"} access is not included in this workspace plan.`,
    );
  if (!mapping) {
    await sendAccountLink(job);
    return;
  }
  const { data: membership } = await service
    .from("organization_members")
    .select("user_id,role_id,permission_level")
    .eq("organization_id", job.organization_id)
    .eq("user_id", mapping.opryn_user_id)
    .maybeSingle();
  if (!membership)
    throw new ChannelPermissionError(
      "Your connected account no longer has access to this Opryn workspace.",
    );
  assertConfiguredAccess(integration.settings, membership);

  const { data: conversation, error: conversationError } = await service
    .from("communication_conversations")
    .upsert(
      {
        organization_id: job.organization_id,
        integration_id: job.integration_id,
        provider: job.provider,
        provider_conversation_id: job.provider_conversation_id,
        opryn_user_id: membership.user_id,
      },
      {
        onConflict: "integration_id,provider_conversation_id,opryn_user_id",
      },
    )
    .select("id")
    .single();
  if (conversationError) throw conversationError;
  const { error: inboundError } = await service
    .from("communication_messages")
    .upsert(
      {
        organization_id: job.organization_id,
        integration_id: job.integration_id,
        conversation_id: conversation.id,
        provider_message_id: job.provider_message_id,
        direction: "inbound",
        content: job.message_text,
      },
      {
        onConflict: "integration_id,provider_message_id,direction",
        ignoreDuplicates: true,
      },
    );
  if (inboundError) throw inboundError;
  const { data: recent } = await service
    .from("communication_messages")
    .select("direction,content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(7);
  const history = (recent ?? [])
    .slice(1)
    .reverse()
    .map((message) => ({
      role:
        message.direction === "inbound"
          ? ("user" as const)
          : ("opryn" as const),
      text: message.content.slice(0, 1200),
    }));
  const result = await answerCommunicationQuestion({
    service,
    organizationId: job.organization_id,
    userId: membership.user_id,
    provider: job.provider,
    question: job.message_text,
    conversationId: conversation.id,
    history,
  });
  const sent = await postWithIntegrationToken({
    provider: job.provider,
    integrationId: job.integration_id,
    threadId: job.provider_thread_id,
    content: renderAnswerCard(result),
  });
  const outboundContent =
    result.status === "answered"
      ? `${result.headline}\n${result.answer}`
      : "Opryn doesn’t have an approved answer yet.";
  await Promise.all([
    service.from("communication_messages").insert({
      organization_id: job.organization_id,
      integration_id: job.integration_id,
      conversation_id: conversation.id,
      provider_message_id: sent.id,
      direction: "outbound",
      content: outboundContent,
      result_type: result.status,
      question_id: result.questionId,
      knowledge_chunk_ids:
        result.status === "answered"
          ? result.sources.map((source) => source.id)
          : [],
    }),
    service
      .from("communication_integrations")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", job.integration_id),
  ]);
}

async function sendAccountLink(job: Job) {
  const service = createServiceClient();
  const rawToken = createCommunicationToken();
  await service.from("communication_link_tokens").insert({
    organization_id: job.organization_id,
    integration_id: job.integration_id,
    provider_user_id: job.provider_user_id,
    token_hash: hashCommunicationToken(rawToken),
    expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
  });
  await postWithIntegrationToken({
    provider: job.provider,
    integrationId: job.integration_id,
    threadId: job.provider_thread_id,
    content: Card({
      title: "Connect your Opryn account",
      children: [
        CardText(
          "Before I can answer company questions here, securely connect this account to your Opryn team member.",
        ),
        Actions([
          LinkButton({
            url: `${OPRYN_SITE_URL}/app/integrations/link?token=${encodeURIComponent(rawToken)}`,
            label: "Connect Account",
            style: "primary",
          }),
        ]),
      ],
    }),
  });
}

function assertConfiguredAccess(
  value: unknown,
  membership: { user_id: string; role_id: string | null },
) {
  const settings =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const mode = settings.access_mode;
  if (mode === "selected_roles") {
    const roleIds = Array.isArray(settings.role_ids)
      ? settings.role_ids.filter((id): id is string => typeof id === "string")
      : [];
    if (!membership.role_id || !roleIds.includes(membership.role_id))
      throw new ChannelPermissionError(
        "You don’t have access to Opryn from this connection.",
      );
  }
  if (mode === "selected_users") {
    const userIds = Array.isArray(settings.user_ids)
      ? settings.user_ids.filter((id): id is string => typeof id === "string")
      : [];
    if (!userIds.includes(membership.user_id))
      throw new ChannelPermissionError(
        "You don’t have access to Opryn from this connection.",
      );
  }
}
