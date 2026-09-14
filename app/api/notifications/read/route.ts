import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(request: Request) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose at least one notification." },
      { status: 400 },
    );

  const { error } = await context.supabase
    .from("notifications")
    .update({ read: true })
    .in("id", parsed.data.ids)
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id);

  return error
    ? NextResponse.json(
        { error: "Notifications could not be updated." },
        { status: 400 },
      )
    : NextResponse.json({ ok: true });
}
