import "server-only";

import { OPENAI_MODELS } from "@/lib/ai/config";
import { prepareTranscriptionAudio } from "@/lib/ai/media";
import {
  analyzeCallTranscript,
  redactSensitiveCallText,
  transcribeAudio,
} from "@/lib/ai/services";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import { createServiceClient } from "@/lib/supabase/service";
import { getTwilioClient } from "@/lib/twilio/integration";

const MAX_ATTEMPTS = 3;

export async function processTwilioRecording(callId: string) {
  const service = createServiceClient();
  const { data: initial, error: loadError } = await service
    .from("call_recordings")
    .select("*")
    .eq("id", callId)
    .eq("provider", "twilio")
    .maybeSingle();
  if (loadError) throw loadError;
  if (
    !initial ||
    ["needs_review", "approved", "absent", "skipped"].includes(initial.status)
  )
    return;

  const plan = await getOrganizationPlan(service, initial.organization_id);
  if (!hasFeature(plan.plan, "callLearning")) {
    await failCall(
      callId,
      "Twilio Call Learning requires Opryn Premium.",
      true,
    );
    return;
  }

  const { data: integration, error: integrationError } = await service
    .from("phone_integrations")
    .select("*")
    .eq("id", initial.integration_id)
    .eq("organization_id", initial.organization_id)
    .eq("status", "active")
    .maybeSingle();
  if (integrationError) throw integrationError;
  if (!integration) {
    await failCall(callId, "The Twilio integration is no longer active.", true);
    return;
  }

  const { data: settings } = await service
    .from("call_learning_settings")
    .select("*")
    .eq("organization_id", initial.organization_id)
    .maybeSingle();
  if (
    initial.duration_seconds !== null &&
    initial.duration_seconds < (settings?.minimum_duration_seconds ?? 120)
  ) {
    await service
      .from("call_recordings")
      .update({ status: "skipped", error_message: null })
      .eq("id", callId);
    return;
  }

  const { data: claimed } = await service
    .from("call_recordings")
    .update({
      status: initial.transcript_text ? "analyzing" : "downloading",
      processing_started_at: new Date().toISOString(),
      processing_attempts: (initial.processing_attempts ?? 0) + 1,
      next_retry_at: null,
      error_message: null,
    })
    .eq("id", callId)
    .in("status", ["received", "failed", "downloaded", "transcribed"])
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const trace = {
    organizationId: initial.organization_id,
    uploadId: callId,
  };
  try {
    const { authToken, client } = getTwilioClient(integration);
    let transcript = initial.transcript_text as string | null;
    let storagePath = initial.storage_path as string | null;
    let callType = initial.call_type as string;
    if (!transcript) {
      const call = await client.calls(initial.provider_call_id).fetch();
      const incoming = call.direction?.startsWith("inbound") ?? false;
      if (
        (incoming && settings?.analyze_incoming === false) ||
        (!incoming && settings?.analyze_outgoing === false)
      ) {
        await service
          .from("call_recordings")
          .update({
            status: "skipped",
            direction: call.direction,
            from_number: call.from,
            to_number: call.to,
            error_message: null,
          })
          .eq("id", callId);
        return;
      }
      const businessNumber = call.direction?.startsWith("inbound")
        ? call.to
        : call.from;
      const { data: mapping } = businessNumber
        ? await service
            .from("twilio_number_mappings")
            .select("assigned_user_id,assigned_label")
            .eq("integration_id", integration.id)
            .eq("phone_number", businessNumber)
            .eq("enabled", true)
            .maybeSingle()
        : { data: null };
      if (mapping?.assigned_label?.toLowerCase().includes("sales"))
        callType = "sales";
      let buffer: Buffer;
      if (storagePath) {
        const { data: savedRecording, error: savedRecordingError } =
          await service.storage.from("call-recordings").download(storagePath);
        if (savedRecordingError) throw savedRecordingError;
        buffer = Buffer.from(await savedRecording.arrayBuffer());
      } else {
        const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(integration.account_identifier)}/Recordings/${encodeURIComponent(initial.provider_recording_id)}.wav`;
        const recording = await fetch(mediaUrl, {
          headers: {
            authorization: `Basic ${Buffer.from(`${integration.account_identifier}:${authToken}`).toString("base64")}`,
          },
          cache: "no-store",
        });
        if (!recording.ok)
          throw new Error(
            `Twilio recording download failed (${recording.status}).`,
          );
        buffer = Buffer.from(await recording.arrayBuffer());
        if (!buffer.length)
          throw new Error("Twilio returned an empty recording.");
        storagePath = `${initial.organization_id}/${callId}/${initial.provider_recording_id}.wav`;
        const { error: uploadError } = await service.storage
          .from("call-recordings")
          .upload(storagePath, buffer, {
            contentType: "audio/wav",
            upsert: true,
          });
        if (uploadError) throw uploadError;
      }
      await service
        .from("call_recordings")
        .update({
          status: "downloaded",
          storage_path: storagePath,
          original_name: `${initial.provider_recording_id}.wav`,
          mime_type: "audio/wav",
          size_bytes: buffer.length,
          direction: call.direction,
          from_number: call.from,
          to_number: call.to,
          assigned_user_id: mapping?.assigned_user_id ?? null,
          call_type: callType,
        })
        .eq("id", callId);

      const prepared = await prepareTranscriptionAudio(
        buffer,
        `${initial.provider_recording_id}.wav`,
        "audio/wav",
      );
      await service
        .from("call_recordings")
        .update({ status: "transcribing" })
        .eq("id", callId);
      const transcription = await transcribeAudio(
        prepared.buffer,
        prepared.fileName,
        prepared.mimeType,
        trace,
      );
      transcript = redactSensitiveCallText(transcription.text);
      await service
        .from("call_recordings")
        .update({
          status: "transcribed",
          transcript_text: transcript,
          transcription_model: transcription.model,
        })
        .eq("id", callId);
    }

    await service
      .from("call_recordings")
      .update({ status: "analyzing" })
      .eq("id", callId);
    const learned = await analyzeCallTranscript(transcript, callType, trace);
    const { error: cleanupError } = await service
      .from("call_findings")
      .delete()
      .eq("call_id", callId)
      .eq("organization_id", initial.organization_id)
      .neq("status", "approved");
    if (cleanupError) throw cleanupError;
    const { error: findingsError } = learned.findings.length
      ? await service.from("call_findings").insert(
          learned.findings.map((finding) => ({
            organization_id: initial.organization_id,
            call_id: callId,
            finding_type: finding.type,
            title: finding.title,
            content: finding.content,
            evidence: finding.evidence,
            confidence: finding.confidence,
            status: finding.needs_clarification ? "unknown" : "observed",
          })),
        )
      : { error: null };
    if (findingsError) throw findingsError;

    const retentionDays = settings?.retention_days ?? 7;
    const retentionUntil = retentionDays
      ? new Date(Date.now() + retentionDays * 86400000).toISOString()
      : new Date().toISOString();
    const { error: finalError } = await service
      .from("call_recordings")
      .update({
        status: "needs_review",
        analysis_summary: learned.summary,
        analysis_model: OPENAI_MODELS.text,
        retention_until: retentionUntil,
        next_retry_at: null,
        error_message: null,
      })
      .eq("id", callId);
    if (finalError) throw finalError;
    await service
      .from("phone_integrations")
      .update({
        last_successful_import_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", integration.id);
    if (retentionDays === 0 && storagePath) {
      await service.storage.from("call-recordings").remove([storagePath]);
      await service
        .from("call_recordings")
        .update({ storage_path: null })
        .eq("id", callId);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Twilio call processing failed.";
    await failCall(callId, message, false);
    console.error("[Opryn Calls] Twilio processing failed", {
      organizationId: initial.organization_id,
      callId,
      recordingSid: initial.provider_recording_id,
      error: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function failCall(callId: string, message: string, permanent: boolean) {
  const service = createServiceClient();
  const { data } = await service
    .from("call_recordings")
    .select("processing_attempts")
    .eq("id", callId)
    .single();
  const attempts = data?.processing_attempts ?? 0;
  const canRetry = !permanent && attempts < MAX_ATTEMPTS;
  const delayMinutes = Math.max(1, 2 ** Math.max(0, attempts - 1));
  await service
    .from("call_recordings")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      next_retry_at: canRetry
        ? new Date(Date.now() + delayMinutes * 60000).toISOString()
        : null,
    })
    .eq("id", callId);
}

export async function processPendingTwilioRecordings(limit = 3) {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("call_recordings")
    .select("id")
    .eq("provider", "twilio")
    .in("status", ["received", "failed"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .lt("processing_attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(limit);
  if (error) throw error;
  for (const call of data ?? []) await processTwilioRecording(call.id);
  return data?.length ?? 0;
}

export async function deleteExpiredCallAudio(limit = 100) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("call_recordings")
    .select("id,storage_path")
    .eq("provider", "twilio")
    .not("storage_path", "is", null)
    .lte("retention_until", new Date().toISOString())
    .limit(limit);
  if (error) throw error;
  const paths = (data ?? []).flatMap((call) =>
    call.storage_path ? [call.storage_path] : [],
  );
  if (paths.length) await service.storage.from("call-recordings").remove(paths);
  if (data?.length)
    await service
      .from("call_recordings")
      .update({ storage_path: null })
      .in(
        "id",
        data.map((call) => call.id),
      );
  return paths.length;
}
