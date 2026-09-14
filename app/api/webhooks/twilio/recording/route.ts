import { after, NextResponse } from "next/server";
import twilio from "twilio";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import { createServiceClient } from "@/lib/supabase/service";
import { getTwilioRecordingWebhookUrl } from "@/lib/twilio/config";
import {
  getActiveTwilioIntegration,
  getTwilioClient,
} from "@/lib/twilio/integration";
import { processTwilioRecording } from "@/lib/twilio/processing";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const form = new URLSearchParams(rawBody);
  const accountSid = form.get("AccountSid") ?? "";
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!accountSid || !signature)
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });

  const integration = await getActiveTwilioIntegration(accountSid);
  if (!integration)
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  const { authToken } = getTwilioClient(integration);
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) params[key] = value;
  const valid = twilio.validateRequest(
    authToken,
    signature,
    getTwilioRecordingWebhookUrl(),
    params,
  );
  if (!valid)
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });

  const recordingSid = form.get("RecordingSid");
  const callSid = form.get("CallSid");
  const status = (form.get("RecordingStatus") ?? "").toLowerCase();
  if (!recordingSid || !callSid)
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const service = createServiceClient();
  const plan = await getOrganizationPlan(service, integration.organization_id);
  if (!hasFeature(plan.plan, "callLearning"))
    return NextResponse.json({ ok: true, ignored: "premium_required" });

  await service
    .from("phone_integrations")
    .update({ last_webhook_at: new Date().toISOString() })
    .eq("id", integration.id);

  const { data: existing } = await service
    .from("call_recordings")
    .select("id")
    .eq("provider", "twilio")
    .eq("provider_recording_id", recordingSid)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, duplicate: true });

  const duration = Number.parseInt(form.get("RecordingDuration") ?? "0", 10);
  const channels = Number.parseInt(form.get("RecordingChannels") ?? "1", 10);
  const terminalStatus =
    status === "completed"
      ? "received"
      : status === "absent"
        ? "absent"
        : "failed";
  const { data: call, error } = await service
    .from("call_recordings")
    .insert({
      organization_id: integration.organization_id,
      uploaded_by: null,
      title: `Twilio call · ${new Date().toLocaleDateString("en-US")}`,
      call_type: "customer",
      storage_path: null,
      original_name: null,
      mime_type: "audio/wav",
      size_bytes: null,
      status: terminalStatus,
      provider: "twilio",
      integration_id: integration.id,
      provider_call_id: callSid,
      provider_recording_id: recordingSid,
      external_recording_url: form.get("RecordingUrl"),
      duration_seconds: Number.isFinite(duration) ? duration : null,
      channels: Number.isFinite(channels) ? channels : 1,
      recording_track: form.get("RecordingTrack") ?? "both",
      error_message:
        terminalStatus === "absent"
          ? "Twilio did not provide a usable recording for this call."
          : terminalStatus === "failed"
            ? "Twilio could not complete this recording."
            : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ ok: true, duplicate: true });
    console.error("[Opryn Calls] Recording webhook persistence failed", {
      organizationId: integration.organization_id,
      recordingSid,
      error: error.code,
    });
    return NextResponse.json({ error: "persistence_failed" }, { status: 500 });
  }

  if (terminalStatus === "received") {
    const { data: settings } = await service
      .from("call_learning_settings")
      .select("automatic_processing")
      .eq("organization_id", integration.organization_id)
      .maybeSingle();
    if (settings?.automatic_processing ?? true)
      after(() => processTwilioRecording(call.id));
  }
  return NextResponse.json({ ok: true });
}
