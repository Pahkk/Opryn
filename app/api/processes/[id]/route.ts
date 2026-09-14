import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(5000),
  purpose: z.string().trim().max(5000),
  roleId: z.string().uuid().nullable().optional(),
  expertId: z.string().uuid().nullable().optional(),
  criticality: z.enum(["normal", "critical"]).optional(),
  steps: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(300),
        description: z.string().trim().max(10000),
      }),
    )
    .min(1)
    .max(100),
  rules: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(200),
        text: z.string().trim().min(1).max(10000),
        confidence: z.number().min(0).max(1).nullable().optional(),
      }),
    )
    .max(100),
  exceptions: z
    .array(z.object({ text: z.string().trim().min(1).max(10000) }))
    .max(100),
  clarifications: z
    .array(
      z.object({
        id: z.string().uuid(),
        answer: z.string().trim().max(10000),
        suggestedRule: z.string().trim().max(10000),
      }),
    )
    .max(20),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the process fields and try again." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const { data: existing } = await supabase
    .from("processes")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json({ error: "Process not found." }, { status: 404 });
  try {
    const { error } = await supabase
      .from("processes")
      .update({
        title: parsed.data.title,
        summary: parsed.data.summary,
        purpose: parsed.data.purpose,
        assigned_expert_id: parsed.data.expertId ?? null,
        criticality: parsed.data.criticality ?? "normal",
        edited_before_approval:
          existing.status === "approved" ? undefined : true,
        status: existing.status === "approved" ? "approved" : "needs_review",
      })
      .eq("id", id);
    if (error) throw error;
    for (const table of [
      "process_steps",
      "process_rules",
      "process_exceptions",
    ] as const) {
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("process_id", id)
        .eq("organization_id", membership.organization_id);
      if (deleteError) throw deleteError;
    }
    const { error: assignmentDeleteError } = await supabase
      .from("process_role_assignments")
      .delete()
      .eq("process_id", id)
      .eq("organization_id", membership.organization_id);
    if (assignmentDeleteError) throw assignmentDeleteError;
    if (parsed.data.roleId) {
      const { error: assignmentError } = await supabase
        .from("process_role_assignments")
        .insert({
          organization_id: membership.organization_id,
          process_id: id,
          role_id: parsed.data.roleId,
        });
      if (assignmentError) throw assignmentError;
    }
    const { error: stepError } = await supabase.from("process_steps").insert(
      parsed.data.steps.map((step, index) => ({
        organization_id: membership.organization_id,
        process_id: id,
        step_order: index + 1,
        title: step.title,
        description: step.description,
      })),
    );
    if (stepError) throw stepError;
    if (parsed.data.rules.length) {
      const { error: ruleError } = await supabase.from("process_rules").insert(
        parsed.data.rules.map((rule) => ({
          organization_id: membership.organization_id,
          process_id: id,
          title: rule.title,
          text: rule.text,
          confidence: rule.confidence ?? null,
          status: existing.status === "approved" ? "approved" : "draft",
          created_by: user.id,
          approved_by: existing.status === "approved" ? user.id : null,
          approved_at:
            existing.status === "approved" ? new Date().toISOString() : null,
        })),
      );
      if (ruleError) throw ruleError;
    }
    if (parsed.data.exceptions.length) {
      const { error: exceptionError } = await supabase
        .from("process_exceptions")
        .insert(
          parsed.data.exceptions.map((item) => ({
            organization_id: membership.organization_id,
            process_id: id,
            text: item.text,
          })),
        );
      if (exceptionError) throw exceptionError;
    }
    for (const clarification of parsed.data.clarifications) {
      const { error: clarificationError } = await supabase
        .from("clarification_questions")
        .update({
          answer: clarification.answer || null,
          suggested_rule: clarification.suggestedRule || null,
          status: clarification.answer ? "answered" : "open",
          answered_by: clarification.answer ? user.id : null,
        })
        .eq("id", clarification.id)
        .eq("process_id", id);
      if (clarificationError) throw clarificationError;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Unable to save this process.");
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const { error } = await context.supabase
    .from("processes")
    .delete()
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id);
  return error
    ? apiError(error, "Unable to delete this process.")
    : NextResponse.json({ ok: true });
}
