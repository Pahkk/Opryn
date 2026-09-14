import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeInviteCredential } from "@/lib/invite-code";
import { createClient } from "@/lib/supabase/server";
const schema = z.object({ token: z.string().trim().min(8).max(500) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This invitation link is invalid." },
      { status: 400 },
    );
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user)
    return NextResponse.json(
      { error: "Sign in to accept this invitation." },
      { status: 401 },
    );
  const { data, error } = await supabase.rpc("accept_organization_invite", {
    raw_token: normalizeInviteCredential(parsed.data.token),
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const response = NextResponse.json({ organizationId: data });
  response.cookies.set("opryn-organization", String(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
  return response;
}
