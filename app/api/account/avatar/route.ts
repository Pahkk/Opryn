import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rejectCrossOrigin } from "@/lib/request-origin";

const bucket = "account-avatars";
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });
  const { data } = await supabase
    .from("account_settings")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.avatar_path) return new Response(null, { status: 404 });
  const { data: file, error } = await supabase.storage
    .from(bucket)
    .download(data.avatar_path);
  if (error || !file) return new Response(null, { status: 404 });
  return new Response(await file.arrayBuffer(), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const form = await request.formData().catch(() => null);
  const file = form?.get("avatar");
  const revision = Number(form?.get("revision"));
  const zoom = Number(form?.get("zoom") ?? 1);
  const x = Number(form?.get("x") ?? 0.5),
    y = Number(form?.get("y") ?? 0.5);
  if (
    !(file instanceof File) ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 3 * 1024 * 1024 ||
    !file.size ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    !Number.isFinite(zoom) ||
    zoom < 1 ||
    zoom > 3 ||
    !Number.isFinite(x) ||
    x < 0 ||
    x > 1 ||
    !Number.isFinite(y) ||
    y < 0 ||
    y > 1
  )
    return NextResponse.json(
      { error: "Choose a PNG, JPEG, or WebP image under 3 MB." },
      { status: 400 },
    );
  let buffer: Buffer;
  try {
    const input = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
      animated: false,
    })
      .rotate()
      .toBuffer({ resolveWithObject: true });
    if (!["png", "jpeg", "webp"].includes(input.info.format)) throw new Error();
    const size = Math.max(
      1,
      Math.floor(Math.min(input.info.width, input.info.height) / zoom),
    );
    buffer = await sharp(input.data)
      .extract({
        left: Math.round((input.info.width - size) * x),
        top: Math.round((input.info.height - size) * y),
        width: size,
        height: size,
      })
      .resize(256, 256)
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      {
        error:
          "This image could not be read. Choose a smaller PNG, JPEG, or WebP.",
      },
      { status: 400 },
    );
  }
  const { data: previous, error: readError } = await supabase
    .from("account_settings")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError)
    return NextResponse.json(
      { error: "Your avatar could not be loaded." },
      { status: 500 },
    );
  const path = `${user.id}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: "image/webp", upsert: false });
  if (uploadError)
    return NextResponse.json(
      { error: "Your image could not be uploaded. Try again." },
      { status: 500 },
    );
  const { data, error } = await supabase.rpc("save_account_settings", {
    expected_revision: revision,
    changes: { avatar_path: path, avatar_hidden: false },
  });
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    return NextResponse.json(
      {
        error:
          error.code === "40001"
            ? "Your profile changed. Reload before uploading again."
            : "Your avatar could not be saved.",
      },
      { status: error.code === "40001" ? 409 : 500 },
    );
  }
  if (previous?.avatar_path)
    await supabase.storage.from(bucket).remove([previous.avatar_path]);
  return NextResponse.json({
    revision: data.revision,
    avatarUrl: `/api/account/avatar?v=${data.revision}`,
  });
}
export async function DELETE(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(body?.revision) || body.revision < 1)
    return NextResponse.json(
      { error: "Reload your profile and try again." },
      { status: 400 },
    );
  const { data: previous } = await supabase
    .from("account_settings")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data, error } = await supabase.rpc("save_account_settings", {
    expected_revision: body.revision,
    changes: { avatar_path: null, avatar_hidden: true },
  });
  if (error)
    return NextResponse.json(
      {
        error:
          "Your profile changed or could not be saved. Reload and try again.",
      },
      { status: error.code === "40001" ? 409 : 500 },
    );
  if (previous?.avatar_path)
    await supabase.storage.from(bucket).remove([previous.avatar_path]);
  return NextResponse.json({ revision: data.revision });
}
