import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
const schema = z
  .object({ roleId: z.uuid(), processIds: z.array(z.uuid()).min(1).max(200) })
  .strict();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open Team Learning in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const p = schema.safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Select a role and approved processes." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("assign_role_learning", {
      target_org: ctx.membership.organization_id,
      target_role: p.data.roleId,
      process_ids: p.data.processIds,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ ok: true, processes: r.data });
  } catch (e) {
    return apiError(e, "Role learning could not be assigned.");
  }
}
export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open Team Learning in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const p = z
    .object({ roleId: z.uuid(), processId: z.uuid() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Select a role requirement." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("remove_role_learning", {
      target_org: ctx.membership.organization_id,
      target_role: p.data.roleId,
      target_process: p.data.processId,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Role requirement could not be removed.");
  }
}
