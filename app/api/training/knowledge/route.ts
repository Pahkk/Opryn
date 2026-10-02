import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open training in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const p = z
    .object({
      roleId: z.uuid(),
      knowledgeIds: z.array(z.uuid()).min(1).max(100),
      stage: z.enum(["day_one", "core", "advanced"]).default("core"),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Choose a role and approved knowledge." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("assign_role_knowledge", {
      target_org: ctx.membership.organization_id,
      target_role: p.data.roleId,
      knowledge_ids: p.data.knowledgeIds,
      learning_stage: p.data.stage,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ assigned: r.data });
  } catch (e) {
    return apiError(
      e,
      "Training could not be assigned. Check the role’s knowledge access.",
    );
  }
}
