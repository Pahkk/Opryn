import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const schema = z.object({
  feedbackType: z.enum(["helpful", "not_right"]),
  reason: z
    .enum([
      "outdated",
      "wrong_policy",
      "missing_information",
      "didnt_answer",
      "other",
    ])
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    (parsed.data.feedbackType === "not_right" && !parsed.data.reason)
  )
    return NextResponse.json(
      { error: "Choose what was wrong with the answer." },
      { status: 400 },
    );

  const { id } = await params;
  const { supabase, user, membership } = context;
  const { data: question } = await supabase
    .from("employee_questions")
    .select("id")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .eq("asked_by", user.id)
    .maybeSingle();
  if (!question)
    return NextResponse.json(
      { error: "This answer is no longer available." },
      { status: 404 },
    );

  try {
    const { data: source } = await supabase
      .from("question_sources")
      .select("knowledge_chunk_id")
      .eq("question_id", id)
      .eq("organization_id", membership.organization_id)
      .order("similarity", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("knowledge_feedback").upsert(
      {
        organization_id: membership.organization_id,
        knowledge_chunk_id: source?.knowledge_chunk_id ?? null,
        question_id: id,
        user_id: user.id,
        feedback_type: parsed.data.feedbackType,
        reason:
          parsed.data.feedbackType === "not_right" ? parsed.data.reason : null,
        status: "open",
        resolved_at: null,
      },
      { onConflict: "question_id,user_id" },
    );
    if (error) throw error;
    await supabase.from("knowledge_events").insert({
      organization_id: membership.organization_id,
      event_type:
        parsed.data.feedbackType === "helpful"
          ? "answer_feedback_positive"
          : "answer_feedback_negative",
      actor_id: user.id,
      question_id: id,
      knowledge_chunk_id: source?.knowledge_chunk_id ?? null,
      metadata: { reason: parsed.data.reason ?? null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't save that feedback. Please try again.",
    );
  }
}
