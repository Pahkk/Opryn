import { NextResponse } from "next/server";
import { z } from "zod";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";
import { externalKnowledgePolicySchema } from "@/lib/external-ai/policy";
import { apiError } from "@/lib/api";
const schema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    policy: externalKnowledgePolicySchema,
    unknownBehavior: z.enum(["route_expert", "record_only"]),
    retentionDays: z.number().int().min(7).max(365),
  })
  .strict();
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open these settings in Opryn." },
      { status: 403 },
    );
  const ctx = await getExternalAIAdminContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "Choose valid workspace access settings." },
      { status: 400 },
    );
  try {
    const r = await ctx.supabase.rpc("set_external_ai_policy", {
      target_org: ctx.membership.organization_id,
      target_connection: id,
      expected_updated: parsed.data.expectedUpdatedAt,
      policy: parsed.data.policy,
      unknown_mode: parsed.data.unknownBehavior,
      retention_days: parsed.data.retentionDays,
    });
    if (r.error) {
      if (r.error.code === "40001")
        return NextResponse.json(
          { error: "Connection changed. Reload before saving." },
          { status: 409 },
        );
      throw r.error;
    }
    return NextResponse.json({ ok: true, updatedAt: r.data });
  } catch (error) {
    return apiError(error, "AI access settings could not be saved.");
  }
}
