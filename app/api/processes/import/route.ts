import { NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api";
import { extractLearningFile, LearningFileError } from "@/lib/ai/learning-file";
import { LEARNING_FILE_MAX_BYTES } from "@/lib/learning-files";
import { replaceExtractedProcess } from "@/lib/processes";
import { OPENAI_MODELS } from "@/lib/ai/config";

export const maxDuration = 180;

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    return NextResponse.json(
      { error: "Choose a file to upload." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  let processId: string | undefined;
  try {
    // Count actual bytes, not just an optional/untrusted Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) throw new LearningFileError("Choose a file to upload.");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LEARNING_FILE_MAX_BYTES + 16_384) {
        await reader.cancel();
        return NextResponse.json(
          { error: "Upload one file at a time, up to 4 MB." },
          { status: 413 },
        );
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type")! },
    })
      .formData()
      .catch(() => {
        throw new LearningFileError(
          "The upload was incomplete. Choose the file and retry.",
        );
      });
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1)
      throw new LearningFileError("Choose one file to upload.");
    if (file.name.length > 200 || /[\x00-\x1f]/.test(file.name))
      throw new LearningFileError(
        "Rename this file using a shorter, readable filename.",
      );
    const extracted = await extractLearningFile(file);
    const { data, error } = await supabase
      .from("processes")
      .insert({
        organization_id: membership.organization_id,
        created_by: user.id,
        title: extracted.title,
        description: `Uploaded source: ${file.name}. Findings require review.`,
        // Preserve the existing schema: a file is a source for captured knowledge.
        learning_source: "text",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    processId = data.id;
    await replaceExtractedProcess(
      supabase,
      data.id,
      membership.organization_id,
      user.id,
      extracted,
      { model: OPENAI_MODELS.text },
    );
    return NextResponse.json({ processId: data.id, ready: true });
  } catch (error) {
    if (processId) {
      // Only remove the new, incomplete import from this request, never prior knowledge.
      await supabase
        .from("processes")
        .delete()
        .eq("id", processId)
        .eq("organization_id", membership.organization_id)
        .eq("created_by", user.id)
        .neq("status", "approved");
    }
    if (error instanceof LearningFileError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(
      error,
      "This file couldn't be read or saved. Try an unlocked Word/PDF file or a clearer image. Your other imports are unchanged.",
    );
  }
}
