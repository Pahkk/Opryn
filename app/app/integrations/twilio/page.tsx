import { PageHeading } from "@/components/app/page-heading";
import { CallsLocked } from "@/components/app/calls-workspace";
import { TwilioIntegration } from "@/components/app/twilio-integration";
import { requireAdminContext } from "@/lib/app-context";
import { hasFeature } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getTwilioRecordingWebhookUrl,
  maskTwilioAccountSid,
} from "@/lib/twilio/config";
import { defaultCallLearningSettings } from "@/lib/twilio/integration";

export default async function TwilioIntegrationPage() {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization.id;
  const subscription = await getOrganizationPlan(supabase, organizationId);
  if (!hasFeature(subscription.plan, "callLearning"))
    return (
      <>
        <PageHeading
          eyebrow="Premium integration"
          title="Twilio Call Learning"
          description="Automatically turn authorized Twilio recordings into reviewable company knowledge."
        />
        <CallsLocked />
      </>
    );

  const service = createServiceClient();
  const [integrationResult, settingsResult, mappingsResult, membersResult] =
    await Promise.all([
      service
        .from("phone_integrations")
        .select(
          "id,account_identifier,status,last_webhook_at,last_successful_import_at",
        )
        .eq("organization_id", organizationId)
        .eq("provider", "twilio")
        .eq("status", "active")
        .maybeSingle(),
      service
        .from("call_learning_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      service
        .from("twilio_number_mappings")
        .select(
          "id,phone_number,friendly_name,assigned_user_id,assigned_label,enabled",
        )
        .eq("organization_id", organizationId)
        .order("friendly_name"),
      supabase
        .from("organization_members")
        .select(
          "user_id,profiles!organization_members_user_id_fkey(full_name,email)",
        )
        .eq("organization_id", organizationId),
    ]);
  const rawSettings = settingsResult.data;
  const members = (membersResult.data ?? []).map((membership) => {
    const raw = membership.profiles as unknown;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as {
      full_name: string | null;
      email: string;
    };
    return {
      id: membership.user_id,
      name: profile.full_name || profile.email,
    };
  });
  return (
    <>
      <PageHeading
        eyebrow="Premium integration"
        title="Twilio Call Learning"
        description="Your team keeps taking calls normally. Opryn learns after the recording is ready."
      />
      <TwilioIntegration
        integration={
          integrationResult.data
            ? {
                maskedAccount: maskTwilioAccountSid(
                  integrationResult.data.account_identifier,
                ),
                status: integrationResult.data.status,
                lastWebhookAt: integrationResult.data.last_webhook_at,
                lastImportAt: integrationResult.data.last_successful_import_at,
              }
            : null
        }
        initialSettings={{
          analyzeSales:
            rawSettings?.analyze_sales ??
            defaultCallLearningSettings.analyzeSales,
          analyzeSupport:
            rawSettings?.analyze_support ??
            defaultCallLearningSettings.analyzeSupport,
          analyzeIncoming:
            rawSettings?.analyze_incoming ??
            defaultCallLearningSettings.analyzeIncoming,
          analyzeOutgoing:
            rawSettings?.analyze_outgoing ??
            defaultCallLearningSettings.analyzeOutgoing,
          analyzeVoicemail:
            rawSettings?.analyze_voicemail ??
            defaultCallLearningSettings.analyzeVoicemail,
          minimumDurationSeconds:
            rawSettings?.minimum_duration_seconds ??
            defaultCallLearningSettings.minimumDurationSeconds,
          automaticProcessing:
            rawSettings?.automatic_processing ??
            defaultCallLearningSettings.automaticProcessing,
          retentionDays:
            (rawSettings?.retention_days as 0 | 7 | 30 | 90 | undefined) ??
            defaultCallLearningSettings.retentionDays,
        }}
        initialMappings={(mappingsResult.data ?? []).map((mapping) => ({
          id: mapping.id,
          phoneNumber: mapping.phone_number,
          friendlyName: mapping.friendly_name ?? "",
          assignedUserId: mapping.assigned_user_id,
          assignedLabel: mapping.assigned_label ?? "",
          enabled: mapping.enabled,
        }))}
        members={members}
        webhookUrl={getTwilioRecordingWebhookUrl()}
      />
    </>
  );
}
