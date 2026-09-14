import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { rejectCrossOrigin } from "@/lib/request-origin";
const changesSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    industry: z.string().trim().min(1).max(100).optional(),
    employee_count: z.number().int().min(0).max(100000).optional(),
    description: z.string().trim().max(2000).optional(),
    default_timezone: z.string().max(80).optional(),
    employees_can_ask: z.boolean().optional(),
    allow_escalations: z.boolean().optional(),
    confidence_threshold: z.number().min(0.5).max(0.95).optional(),
    estimated_interruption_minutes: z.number().min(0.5).max(30).optional(),
    expert_answers_require_admin_approval: z.boolean().optional(),
    ai_process_creation: z.enum(["always_ask", "auto_draft"]).optional(),
    ai_process_approval_prompt: z
      .enum(["ask_immediately", "add_to_needs_approval"])
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export async function PATCH(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      revision: z.number().int().positive(),
      changes: changesSchema,
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the settings and try again." },
      { status: 400 },
    );
  if (parsed.data.organizationId !== context.membership.organization_id)
    return NextResponse.json(
      { error: "Your active workspace changed. Reload before saving." },
      { status: 409 },
    );
  const { data, error } = await context.supabase.rpc(
    "save_workspace_settings",
    {
      workspace_id: context.membership.organization_id,
      expected_revision: parsed.data.revision,
      changes: parsed.data.changes,
    },
  );
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "40001"
            ? "These settings changed in another tab. Reload before saving."
            : "The settings could not be saved. Check the values and try again.",
      },
      { status: error.code === "40001" ? 409 : 400 },
    );
  return NextResponse.json({ revision: data });
}
