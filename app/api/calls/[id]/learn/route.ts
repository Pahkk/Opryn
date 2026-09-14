import { after, NextResponse } from "next/server";
import { OPENAI_MODELS } from "@/lib/ai/config";
import {
  prepareTranscriptionAudio,
  UnsupportedRecordingError,
} from "@/lib/ai/media";
import {
  analyzeCallTranscript,
  redactSensitiveCallText,
  transcribeAudio,
} from "@/lib/ai/services";
import { getRequestContext } from "@/lib/api";
import {
  FeatureUnavailableError,
  requireFeature,
} from "@/lib/billing/subscription";
import { processTwilioRecording } from "@/lib/twilio/processing";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const organizationId = context.membership.organization_id;
  try {
    await requireFeature(context.supabase, organizationId, "callLearning");
    const { data: call } = await context.supabase
      .from("call_recordings")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!call)
      return NextResponse.json(
        { error: "Call recording not found." },
        { status: 404 },
      );
    if (call.provider === "twilio") {
      if (!["received", "failed"].includes(call.status))
        return NextResponse.json(
          {
            error:
              call.status === "needs_review" || call.status === "approved"
                ? "This call has already been analyzed."
                : "Opryn is already processing this Twilio recording.",
            status: call.status,
          },
          { status: 409 },
        );
      after(() => processTwilioRecording(id));
      return NextResponse.json(
        { callId: id, status: "received" },
        { status: 202 },
      );
    }
    if (!["uploaded", "failed"].includes(call.status))
      return NextResponse.json(
        {
          error:
            call.status === "needs_review" || call.status === "approved"
              ? "This call has already been analyzed."
              : "Opryn is already analyzing this call.",
          status: call.status,
        },
        { status: 409 },
      );
    const trace = { organizationId, uploadId: call.id };
    let transcript = call.transcript_text as string | null;
    if (!transcript) {
      await updateCall(
        context.supabase,
        id,
        organizationId,
        "extracting_audio",
      );
      const { data: file, error: downloadError } =
        await context.supabase.storage
          .from("call-recordings")
          .download(call.storage_path);
      if (downloadError) throw downloadError;
      const prepared = await prepareTranscriptionAudio(
        Buffer.from(await file.arrayBuffer()),
        call.original_name,
        call.mime_type,
      );
      await updateCall(context.supabase, id, organizationId, "transcribing");
      const result = await transcribeAudio(
        prepared.buffer,
        prepared.fileName,
        prepared.mimeType,
        trace,
      );
      transcript = redactSensitiveCallText(result.text);
      const { error } = await context.supabase
        .from("call_recordings")
        .update({
          transcript_text: transcript,
          transcription_model: result.model,
          status: "analyzing",
          error_message: null,
        })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) throw error;
    } else await updateCall(context.supabase, id, organizationId, "analyzing");
    const learned = await analyzeCallTranscript(
      transcript,
      call.call_type,
      trace,
    );
    const { error: removeError } = await context.supabase
      .from("call_findings")
      .delete()
      .eq("call_id", id)
      .eq("organization_id", organizationId)
      .neq("status", "approved");
    if (removeError) throw removeError;
    if (learned.findings.length) {
      const { error } = await context.supabase.from("call_findings").insert(
        learned.findings.map((finding) => ({
          organization_id: organizationId,
          call_id: id,
          finding_type: finding.type,
          title: finding.title,
          content: finding.content,
          evidence: finding.evidence,
          confidence: finding.confidence,
          status: finding.needs_clarification ? "unknown" : "observed",
        })),
      );
      if (error) throw error;
    }
    const { error: finalError } = await context.supabase
      .from("call_recordings")
      .update({
        status: "needs_review",
        analysis_model: OPENAI_MODELS.text,
        error_message: null,
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (finalError) throw finalError;
    return NextResponse.json({
      callId: id,
      status: "needs_review",
      findingCount: learned.findings.length,
    });
  } catch (error) {
    if (error instanceof FeatureUnavailableError)
      return NextResponse.json(
        { error: error.message, code: "premium_required" },
        { status: 402 },
      );
    await context.supabase
      .from("call_recordings")
      .update({
        status: "failed",
        error_message:
          error instanceof UnsupportedRecordingError
            ? error.message
            : "Call analysis failed. The saved upload can be retried.",
      })
      .eq("id", id)
      .eq("organization_id", organizationId);
    console.error("[Opryn AI] Call learning failed", {
      organizationId,
      callId: id,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error:
          error instanceof UnsupportedRecordingError
            ? error.message
            : "Opryn couldn't analyze this call. Your upload is saved, so you can retry.",
      },
      { status: 500 },
    );
  }
}

async function updateCall(
  supabase: ReturnType<
    typeof import("@/lib/supabase/server").createClient
  > extends Promise<infer T>
    ? T
    : never,
  id: string,
  organizationId: string,
  status: string,
) {
  const { error } = await supabase
    .from("call_recordings")
    .update({ status, error_message: null })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw error;
}
