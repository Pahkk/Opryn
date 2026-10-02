import { NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api";
import { transcribeAudio } from "@/lib/ai/services";
import { AUDIO_MIME_TYPES } from "@/lib/ai/media-types";
import { ASK_VOICE_ENABLED } from "@/lib/ask-features";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!ASK_VOICE_ENABLED)
    return NextResponse.json(
      { error: "Voice input is not available yet. Please type your question." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Use voice input from Opryn." },
      { status: 403 },
    );
  const settings = await context.supabase
    .from("organization_settings")
    .select("employees_can_ask")
    .eq("organization_id", context.membership.organization_id)
    .maybeSingle();
  if (settings.error) return apiError(settings.error);
  if (settings.data?.employees_can_ask === false)
    return NextResponse.json(
      { error: "Ask Opryn is disabled for this workspace." },
      { status: 403 },
    );
  // Same configured transcription service as Teach. Audio is transient and is
  // never inserted into sources, processes, knowledge, or permanent storage.
  const maxBytes = 3_000_000;
  const size = Number(request.headers.get("content-length"));
  const mime = request.headers.get("content-type")?.split(";")[0] ?? "";
  if (!AUDIO_MIME_TYPES.has(mime))
    return NextResponse.json(
      { error: "This recording format is not supported." },
      { status: 415 },
    );
  if (size > maxBytes)
    return NextResponse.json(
      { error: "Keep voice questions under one minute." },
      { status: 413 },
    );
  try {
    // Bound the stream even if Content-Length is missing or dishonest.
    const reader = request.body?.getReader();
    if (!reader)
      return NextResponse.json(
        { error: "No recording received." },
        { status: 400 },
      );
    const parts: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) {
        await reader.cancel();
        return NextResponse.json(
          { error: "The recording is too large." },
          { status: 413 },
        );
      }
      parts.push(value);
    }
    if (!bytes)
      return NextResponse.json(
        { error: "No speech was recorded." },
        { status: 400 },
      );
    const extension =
      mime === "audio/mp4" || mime === "audio/x-m4a"
        ? "m4a"
        : mime.split("/")[1].replace("x-", "");
    const result = await transcribeAudio(
      Buffer.concat(parts),
      `question.${extension}`,
      mime,
      { organizationId: context.membership.organization_id },
    );
    if (result.text.length > 4000)
      return NextResponse.json(
        { error: "Try a shorter question, or type your question instead." },
        { status: 422 },
      );
    return NextResponse.json(
      { text: result.text },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(
      error,
      "Your recording could not be transcribed. Try again or type your question.",
    );
  }
}
