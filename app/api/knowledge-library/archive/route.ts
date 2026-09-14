import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const parsed = z
    .object({ id: z.uuid(), entity: z.enum(["process", "knowledge"]) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a knowledge item." },
      { status: 400 },
    );
  const { error } = await context.supabase.rpc("archive_library_item", {
    target_organization_id: context.membership.organization_id,
    target_id: parsed.data.id,
    target_entity: parsed.data.entity,
  });
  if (error)
    return NextResponse.json(
      { error: "This item could not be archived. Refresh and try again." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true });
}
