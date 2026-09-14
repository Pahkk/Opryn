import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json(
      { error: "Switch workspaces from Opryn." },
      { status: 403 },
    );
  const data = z
    .object({ organizationId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!data.success)
    return NextResponse.json({ error: "Choose a workspace." }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const { data: member, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("organization_id", data.data.organizationId)
    .maybeSingle();
  if (error || !member)
    return NextResponse.json(
      { error: "You no longer have access to that workspace." },
      { status: 403 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set("opryn-organization", data.data.organizationId, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
