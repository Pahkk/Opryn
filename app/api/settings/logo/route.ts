import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, getRequestContext } from "@/lib/api";
import { rejectCrossOrigin } from "@/lib/request-origin";
import sharp from "sharp";

const logoTypes = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const maxLogoSize = 3 * 1024 * 1024;
const bucket = "organization-logos";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  const extension = file instanceof File ? logoTypes.get(file.type) : null;
  if (!(file instanceof File) || !extension || file.size > maxLogoSize) {
    return NextResponse.json(
      { error: "Choose a PNG, JPG, or WebP logo under 3 MB." },
      { status: 400 },
    );
  }

  const organizationId = context.membership.organization_id;
  const { data: organization, error: organizationError } =
    await context.supabase
      .from("organizations")
      .select("logo_path")
      .eq("id", organizationId)
      .single();
  if (organizationError)
    return apiError(organizationError, "Unable to load the business logo.");

  let bytes: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? ""))
      throw new Error();
    bytes = await image
      .rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Choose a valid PNG, JPEG, or WebP image." },
      { status: 400 },
    );
  }
  const storagePath = `${organizationId}/logo-${randomUUID()}.webp`;
  const { error: uploadError } = await context.supabase.storage
    .from(bucket)
    .upload(storagePath, bytes, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError)
    return apiError(uploadError, "Unable to upload the business logo.");

  const { error: updateError } = await context.supabase
    .from("organizations")
    .update({ logo_path: storagePath })
    .eq("id", organizationId);
  if (updateError) {
    await context.supabase.storage.from(bucket).remove([storagePath]);
    return apiError(updateError, "Unable to save the business logo.");
  }

  if (organization.logo_path && organization.logo_path !== storagePath)
    await context.supabase.storage
      .from(bucket)
      .remove([organization.logo_path]);

  const { data: signed } = await context.supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);

  return NextResponse.json({ logoUrl: signed?.signedUrl ?? null });
}

export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;

  const organizationId = context.membership.organization_id;
  const { data: organization, error: organizationError } =
    await context.supabase
      .from("organizations")
      .select("logo_path")
      .eq("id", organizationId)
      .single();
  if (organizationError)
    return apiError(organizationError, "Unable to load the business logo.");

  const { error: updateError } = await context.supabase
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organizationId);
  if (updateError)
    return apiError(updateError, "Unable to remove the business logo.");

  if (organization.logo_path)
    await context.supabase.storage
      .from(bucket)
      .remove([organization.logo_path]);

  return NextResponse.json({ ok: true });
}
