import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getRequestContext, apiError } from "@/lib/api";
import { OPENAI_MODELS } from "@/lib/ai/config";
import { ALLOWED_MEDIA_MIME_TYPES } from "@/lib/ai/media-types";
import { extractProcessFromTranscript } from "@/lib/ai/services";
import { replaceExtractedProcess } from "@/lib/processes";
import {
  FeatureUnavailableError,
  requireFeature,
} from "@/lib/billing/subscription";
import { VIDEO_MIME_TYPES } from "@/lib/ai/media-types";
import { importSharedGoogleDriveText } from "@/lib/google-drive";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).default(""),
  roleId: z.string().uuid().nullable().optional(),
  recommendationId: z.string().uuid().nullable().optional(),
  inputType: z.enum(["text", "media", "google_drive"]),
  captureMethod: z
    .enum([
      "text",
      "voice",
      "video",
      "screen",
      "google_drive",
      "ai_conversation",
    ])
    .optional(),
  explanation: z.string().trim().max(100000).optional(),
  driveUrl: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.string().trim().url().max(2000).optional(),
  ),
  file: z
    .object({
      name: z.string().min(1).max(500),
      type: z.string().min(1),
      size: z
        .number()
        .int()
        .positive()
        .max(100 * 1024 * 1024),
    })
    .optional(),
});
export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return NextResponse.json(
      {
        error:
          field === "title"
            ? "Give this knowledge a clear name before continuing."
            : field === "driveUrl"
              ? "Enter a valid Google Drive sharing link."
              : field === "explanation"
                ? "Explain what your team should know before continuing."
                : "Check the information above and try again.",
      },
      { status: 400 },
    );
  }
  if (parsed.data.inputType === "text" && !parsed.data.explanation)
    return NextResponse.json(
      { error: "Explain the process before continuing." },
      { status: 400 },
    );
  if (parsed.data.inputType === "google_drive" && !parsed.data.driveUrl)
    return NextResponse.json(
      { error: "Paste a Google Drive sharing link." },
      { status: 400 },
    );
  if (
    parsed.data.inputType === "media" &&
    (!parsed.data.file || !ALLOWED_MEDIA_MIME_TYPES.has(parsed.data.file.type))
  )
    return NextResponse.json(
      {
        error: "Upload an MP4, MOV, WEBM, MP3, WAV, or M4A file up to 100 MB.",
      },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  try {
    const driveImport =
      parsed.data.inputType === "google_drive"
        ? await importSharedGoogleDriveText(parsed.data.driveUrl!)
        : null;
    if (
      parsed.data.inputType === "media" &&
      parsed.data.file &&
      VIDEO_MIME_TYPES.has(parsed.data.file.type)
    )
      await requireFeature(
        supabase,
        membership.organization_id,
        "videoLearning",
      );
    const { data: process, error } = await supabase
      .from("processes")
      .insert({
        organization_id: membership.organization_id,
        title: parsed.data.title,
        description: parsed.data.description,
        created_by: user.id,
        learning_source:
          parsed.data.inputType === "google_drive"
            ? "google_drive"
            : (parsed.data.captureMethod ??
              (parsed.data.inputType === "media" ? "voice" : "text")),
        source_url: driveImport?.sourceUrl ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (parsed.data.recommendationId) {
      const { error: recommendationError } = await supabase
        .from("process_recommendations")
        .update({ status: "started", process_id: process.id })
        .eq("id", parsed.data.recommendationId)
        .eq("organization_id", membership.organization_id);
      if (recommendationError) throw recommendationError;
    }
    if (parsed.data.roleId) {
      const { error: roleError } = await supabase
        .from("process_role_assignments")
        .insert({
          organization_id: membership.organization_id,
          process_id: process.id,
          role_id: parsed.data.roleId,
        });
      if (roleError) throw roleError;
    }
    if (
      parsed.data.inputType === "text" ||
      parsed.data.inputType === "google_drive"
    ) {
      const extracted = await extractProcessFromTranscript(
        driveImport?.text ?? parsed.data.explanation!,
        parsed.data.title,
        {
          organizationId: membership.organization_id,
          processId: process.id,
        },
        undefined,
        parsed.data.captureMethod === "ai_conversation"
          ? "ai_conversation"
          : "owner_explanation",
      );
      await replaceExtractedProcess(
        supabase,
        process.id,
        membership.organization_id,
        user.id,
        extracted,
        { model: OPENAI_MODELS.text },
      );
      return NextResponse.json({ processId: process.id, ready: true });
    }
    const extension =
      parsed.data
        .file!.name.split(".")
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase() || "media";
    const storagePath = `${membership.organization_id}/${process.id}/${randomUUID()}.${extension}`;
    const { data: media, error: mediaError } = await supabase
      .from("media_uploads")
      .insert({
        organization_id: membership.organization_id,
        process_id: process.id,
        uploaded_by: user.id,
        storage_path: storagePath,
        original_name: parsed.data.file!.name,
        mime_type: parsed.data.file!.type,
        size_bytes: parsed.data.file!.size,
      })
      .select("id")
      .single();
    if (mediaError) throw mediaError;
    return NextResponse.json({
      processId: process.id,
      mediaId: media.id,
      storagePath,
      ready: false,
    });
  } catch (error) {
    if (parsed.data.inputType === "google_drive" && error instanceof Error)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof FeatureUnavailableError)
      return NextResponse.json(
        { error: error.message, code: "premium_required" },
        { status: 402 },
      );
    return apiError(error, "Unable to create this process.");
  }
}
