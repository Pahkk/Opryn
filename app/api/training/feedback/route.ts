import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open training in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const p = z
    .object({
      knowledgeId: z.uuid(),
      reason: z.enum([
        "outdated",
        "wrong_policy",
        "missing_information",
        "other",
      ]),
      note: z.string().trim().max(2000),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Choose a reason for the review." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("report_training_feedback", {
      target_org: ctx.membership.organization_id,
      target_knowledge: p.data.knowledgeId,
      feedback_reason: p.data.reason,
      feedback_note: p.data.note,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ id: r.data });
  } catch (e) {
    return apiError(e, "Your feedback could not be saved. Please retry.");
  }
}
