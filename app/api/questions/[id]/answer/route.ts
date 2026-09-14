import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { suggestRuleFromOwnerAnswer } from "@/lib/ai/services";

const schema = z.object({
  answer: z.string().trim().min(1).max(10000),
  answerId: z.string().uuid().optional(),
  clarificationAnswers: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        answer: z.string().trim().min(1).max(3000),
      }),
    )
    .max(3)
    .default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Write an answer before continuing." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const isAdmin = ["owner", "admin"].includes(membership.permission_level);
  const { data: question } = await supabase
    .from("employee_questions")
    .select("id,question,assigned_expert_id,assigned_expert_rule_id")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .eq("status", "needs_owner")
    .maybeSingle();
  if (!question)
    return NextResponse.json(
      { error: "This question is no longer waiting for an answer." },
      { status: 404 },
    );
  const isAssignedExpert = question.assigned_expert_id === user.id;
  if (!isAdmin && !isAssignedExpert)
    return NextResponse.json(
      { error: "This question is assigned to another person." },
      { status: 403 },
    );

  try {
    let answerId = parsed.data.answerId;
    if (answerId) {
      const { data: existing } = await supabase
        .from("question_answers")
        .select("id")
        .eq("id", answerId)
        .eq("question_id", id)
        .eq("answered_by", user.id)
        .maybeSingle();
      if (!existing)
        return NextResponse.json(
          { error: "That answer could not be updated." },
          { status: 404 },
        );
    } else {
      const { data: answer, error } = await supabase
        .from("question_answers")
        .insert({
          organization_id: membership.organization_id,
          question_id: id,
          answer: parsed.data.answer,
          answered_by: user.id,
          answer_type: isAdmin ? "owner" : "expert",
          proposed_rule: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      answerId = answer.id;
      await supabase.from("knowledge_events").insert({
        organization_id: membership.organization_id,
        event_type: isAdmin ? "owner_answered" : "expert_answered",
        actor_id: user.id,
        question_id: id,
        metadata: {},
      });
    }

    let suggested = {
      title: isAdmin ? "Owner guidance" : "Expert guidance",
      rule: parsed.data.answer,
      complete: parsed.data.clarificationAnswers.length > 0,
      clarification_questions: parsed.data.clarificationAnswers.length
        ? ([] as string[])
        : [
            "Is this the complete rule, including any limits, approvals, and exceptions?",
          ],
    };
    try {
      suggested = await suggestRuleFromOwnerAnswer(
        question.question,
        parsed.data.answer,
        parsed.data.clarificationAnswers,
      );
    } catch (suggestionError) {
      console.error("Rule suggestion failed; preserving the exact answer", {
        questionId: id,
        message:
          suggestionError instanceof Error
            ? suggestionError.message
            : "Unknown error",
      });
    }
    await supabase
      .from("question_answers")
      .update({ proposed_rule: suggested.rule })
      .eq("id", answerId);

    const [{ data: settings }, { data: expertAuthority }] = await Promise.all([
      supabase
        .from("organization_settings")
        .select("expert_answers_require_admin_approval")
        .eq("organization_id", membership.organization_id)
        .maybeSingle(),
      isAssignedExpert
        ? supabase
            .from("knowledge_experts")
            .select("id")
            .eq("organization_id", membership.organization_id)
            .eq(
              "id",
              question.assigned_expert_rule_id ||
                "00000000-0000-0000-0000-000000000000",
            )
            .eq("user_id", user.id)
            .eq("can_approve", true)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const canApprove =
      isAdmin ||
      (Boolean(expertAuthority) &&
        settings?.expert_answers_require_admin_approval === false);
    await supabase.from("knowledge_events").insert({
      organization_id: membership.organization_id,
      event_type: "knowledge_suggested",
      actor_id: user.id,
      question_id: id,
      metadata: {
        complete: suggested.complete,
        clarification_count: suggested.clarification_questions.length,
      },
    });
    return NextResponse.json({
      answerId,
      title: suggested.title,
      rule: suggested.rule,
      complete: suggested.complete,
      clarificationQuestions: suggested.clarification_questions,
      canApprove,
    });
  } catch (error) {
    return apiError(error, "Unable to save your answer. Please try again.");
  }
}
