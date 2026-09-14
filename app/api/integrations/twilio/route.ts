import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import {
  FeatureUnavailableError,
  requireFeature,
} from "@/lib/billing/subscription";
import { createServiceClient } from "@/lib/supabase/service";
import {
  callLearningSettingsSchema,
  connectTwilio,
  defaultCallLearningSettings,
  twilioConnectionSchema,
} from "@/lib/twilio/integration";

const updateSchema = z.object({
  settings: callLearningSettingsSchema,
  mappings: z
    .array(
      z.object({
        id: z.string().uuid(),
        assignedUserId: z.string().uuid().nullable(),
        assignedLabel: z.string().trim().max(100).nullable(),
        enabled: z.boolean(),
      }),
    )
    .max(100),
});

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = twilioConnectionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Enter a valid Twilio Account SID, Auth Token, and confirm recording consent responsibility.",
      },
      { status: 400 },
    );
  const organizationId = context.membership.organization_id;
  try {
    await requireFeature(context.supabase, organizationId, "callLearning");
    const connected = await connectTwilio({
      organizationId,
      userId: context.user.id,
      accountSid: parsed.data.accountSid,
      authToken: parsed.data.authToken,
    });
    const service = createServiceClient();
    const { error } = await service.from("call_learning_settings").upsert(
      {
        organization_id: organizationId,
        integration_id: connected.integrationId,
        analyze_sales: defaultCallLearningSettings.analyzeSales,
        analyze_support: defaultCallLearningSettings.analyzeSupport,
        analyze_incoming: defaultCallLearningSettings.analyzeIncoming,
        analyze_outgoing: defaultCallLearningSettings.analyzeOutgoing,
        analyze_voicemail: defaultCallLearningSettings.analyzeVoicemail,
        minimum_duration_seconds:
          defaultCallLearningSettings.minimumDurationSeconds,
        automatic_processing: defaultCallLearningSettings.automaticProcessing,
        retention_days: defaultCallLearningSettings.retentionDays,
        acknowledged_by: context.user.id,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
    if (error) throw error;
    await context.supabase.from("call_privacy_acknowledgments").upsert(
      {
        organization_id: organizationId,
        acknowledged_by: context.user.id,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,acknowledged_by" },
    );
    return NextResponse.json({ ok: true, ...connected });
  } catch (error) {
    if (error instanceof FeatureUnavailableError)
      return NextResponse.json(
        { error: error.message, code: "premium_required" },
        { status: 402 },
      );
    console.error("[Opryn Calls] Twilio connection failed", {
      organizationId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error:
          "Opryn couldn't connect to this Twilio account. Check the credentials and try again.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the Call Learning settings and try again." },
      { status: 400 },
    );
  const organizationId = context.membership.organization_id;
  try {
    await requireFeature(context.supabase, organizationId, "callLearning");
    const service = createServiceClient();
    const { data: integration } = await service
      .from("phone_integrations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("provider", "twilio")
      .eq("status", "active")
      .maybeSingle();
    if (!integration)
      return NextResponse.json(
        { error: "Connect Twilio before saving these settings." },
        { status: 404 },
      );
    const settings = parsed.data.settings;
    const { error: settingsError } = await service
      .from("call_learning_settings")
      .upsert(
        {
          organization_id: organizationId,
          integration_id: integration.id,
          analyze_sales: settings.analyzeSales,
          analyze_support: settings.analyzeSupport,
          analyze_incoming: settings.analyzeIncoming,
          analyze_outgoing: settings.analyzeOutgoing,
          analyze_voicemail: settings.analyzeVoicemail,
          minimum_duration_seconds: settings.minimumDurationSeconds,
          automatic_processing: settings.automaticProcessing,
          retention_days: settings.retentionDays,
        },
        { onConflict: "organization_id" },
      );
    if (settingsError) throw settingsError;
    for (const mapping of parsed.data.mappings) {
      const { error } = await service
        .from("twilio_number_mappings")
        .update({
          assigned_user_id: mapping.assignedUserId,
          assigned_label: mapping.assignedLabel,
          enabled: mapping.enabled,
        })
        .eq("id", mapping.id)
        .eq("organization_id", organizationId)
        .eq("integration_id", integration.id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FeatureUnavailableError)
      return NextResponse.json({ error: error.message }, { status: 402 });
    return NextResponse.json(
      { error: "Opryn couldn't save the Twilio settings." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const organizationId = context.membership.organization_id;
  const service = createServiceClient();
  const { error } = await service
    .from("phone_integrations")
    .update({
      status: "disconnected",
      encrypted_credentials: "",
      error_message: null,
    })
    .eq("organization_id", organizationId)
    .eq("provider", "twilio");
  if (error)
    return NextResponse.json(
      { error: "Opryn couldn't disconnect Twilio." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
