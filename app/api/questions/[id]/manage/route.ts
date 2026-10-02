import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";

const schema = z.object({
  action: z.enum(["reroute", "dismiss", "request_clarification", "reply"]),
  expertId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(4000).default(""),
  clarificationId: z.string().uuid().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid question." }, { status: 400 });
  const org = ctx.membership.organization_id;
  const question = await ctx.supabase
    .from("employee_questions")
    .select("asked_by,assigned_expert_id,status")
    .eq("id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (question.error) return apiError(question.error);
  const admin = ["owner", "admin"].includes(ctx.membership.permission_level);
  if (!question.data)
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  if (
    !admin &&
    question.data.assigned_expert_id !== ctx.user.id &&
    question.data.asked_by !== ctx.user.id
  )
    return NextResponse.json(
      { error: "You cannot view this question." },
      { status: 403 },
    );
  const [clarifications, people] = await Promise.all([
    ctx.supabase
      .from("question_clarifications")
      .select("id,message,reply,status,created_at")
      .eq("question_id", id)
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      ? ctx.supabase
          .from("organization_members")
          .select(
            "user_id,profiles!organization_members_user_id_fkey(full_name)",
          )
          .eq("organization_id", org)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clarifications.error || people.error)
    return apiError(clarifications.error || people.error);
  return NextResponse.json({
    canReroute: admin,
    assignedExpertId: question.data.assigned_expert_id,
    clarifications: clarifications.data ?? [],
    people: (people.data ?? []).map((row) => {
      const raw = row.profiles as unknown;
      const profile = (Array.isArray(raw) ? raw[0] : raw) as {
        full_name: string | null;
      } | null;
      return { id: row.user_id, name: profile?.full_name || "Teammate" };
    }),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success)
    return NextResponse.json(
      { error: "Check the question action." },
      { status: 400 },
    );
  const { data, error } = await ctx.supabase.rpc("manage_gap_question", {
    target_organization_id: ctx.membership.organization_id,
    target_question_id: id,
    question_action: parsed.data.action,
    target_expert_id: parsed.data.expertId ?? null,
    action_note: parsed.data.note,
    target_clarification_id: parsed.data.clarificationId ?? null,
  });
  if (error) {
    const status =
      error.code === "42501"
        ? 403
        : error.code === "P0002"
          ? 404
          : error.code === "40001"
            ? 409
            : error.code === "22023"
              ? 400
              : 500;
    return status === 500
      ? apiError(error, "The question could not be updated.")
      : NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json(data);
}
