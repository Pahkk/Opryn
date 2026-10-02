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
      connectionId: z.uuid(),
      version: z.number().int().positive(),
      rules: z.string().trim().min(10).max(4000),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Choose an agent and add behavior rules." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("set_training_agent_behavior", {
      target_org: ctx.membership.organization_id,
      target_connection: p.data.connectionId,
      expected_version: p.data.version,
      rules_value: p.data.rules,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ version: r.data });
  } catch (e) {
    return apiError(
      e,
      "Behavior rules could not be saved. Refresh the agent’s configuration and try again.",
    );
  }
}
