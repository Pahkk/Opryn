import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
const schema = z
  .object({
    knowledgeId: z.uuid(),
    version: z.number().int().positive(),
    format: z.enum([
      "acknowledgement",
      "scenario",
      "short_answer",
      "recognition",
      "step_order",
      "responsibility",
    ]),
    prompt: z.string().trim().min(3).max(2000),
    supportingQuote: z.string().trim().min(1).max(4000),
  })
  .strict();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open training in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const p = schema.safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      {
        error:
          "Choose current approved knowledge, a practice format and an exact supporting excerpt.",
      },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("publish_training_scenario", {
      target_org: ctx.membership.organization_id,
      target_knowledge: p.data.knowledgeId,
      expected_version: p.data.version,
      format_value: p.data.format,
      prompt_value: p.data.prompt,
      quote_value: p.data.supportingQuote,
    });
    if (r.error) throw r.error;
    return NextResponse.json({ id: r.data });
  } catch (e) {
    return apiError(
      e,
      "Scenario could not be published. Check that the supporting excerpt is in the current approved version.",
    );
  }
}
