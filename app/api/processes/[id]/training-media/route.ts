import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

const createSchema = z.object({
  name: z.string().trim().min(1).max(500),
  type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  caption: z.string().trim().max(500).default(""),
});

const deleteSchema = z.object({ mediaId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a JPG, PNG, WEBP, or GIF image under 5 MB." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const organizationId = membership.organization_id;
  try {
    const { data: process } = await supabase
      .from("processes")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .maybeSingle();
    if (!process)
      return NextResponse.json(
        { error: "Approve this process before adding training media." },
        { status: 404 },
      );
    const storagePath = `${organizationId}/${id}/${randomUUID()}.${imageTypes.get(parsed.data.type)}`;
    const { data, error } = await supabase
      .from("process_training_media")
      .insert({
        organization_id: organizationId,
        process_id: id,
        uploaded_by: user.id,
        storage_path: storagePath,
        mime_type: parsed.data.type,
        original_name: parsed.data.name.replace(/[^a-zA-Z0-9._ -]/g, "_"),
        caption: parsed.data.caption,
        size_bytes: parsed.data.size,
      })
      .select("id,storage_path,caption,original_name")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, "Unable to add this training image.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Image not found." }, { status: 400 });
  const { supabase, membership } = context;
  try {
    const { data } = await supabase
      .from("process_training_media")
      .select("id,storage_path")
      .eq("id", parsed.data.mediaId)
      .eq("process_id", id)
      .eq("organization_id", membership.organization_id)
      .maybeSingle();
    if (!data)
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    await supabase.storage.from("training-media").remove([data.storage_path]);
    const { error } = await supabase
      .from("process_training_media")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", membership.organization_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to remove this training image.");
  }
}
