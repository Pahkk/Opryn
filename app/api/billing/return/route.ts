import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/billing/stripe";
/** Restore only verified membership context. This route grants NO entitlement. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspace = z
    .string()
    .uuid()
    .safeParse(url.searchParams.get("workspace"));
  if (!workspace.success)
    return NextResponse.json({ error: "Invalid workspace." }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.redirect(
      new URL(
        `/login?next=${encodeURIComponent(url.pathname + url.search)}`,
        getAppUrl(),
      ),
    );
  const membership = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", workspace.data)
    .eq("user_id", data.user.id)
    .in("permission_level", ["owner", "admin"])
    .maybeSingle();
  if (membership.error || !membership.data)
    return NextResponse.json(
      { error: "Workspace access is unavailable." },
      { status: 403 },
    );
  const billing =
    url.searchParams.get("billing") === "canceled" ? "canceled" : "confirming";
  const response = NextResponse.redirect(
    new URL(`/onboarding?billing=${billing}`, getAppUrl()),
  );
  response.cookies.set("opryn-organization", workspace.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
  return response;
}
