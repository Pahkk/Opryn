import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { suggestRuleFromOwnerAnswer } from "@/lib/ai/services";
import { getExternalAIAnswerContext } from "@/lib/external-ai/admin";

const schema = z.object({
  action: z.enum([
    "suggest",
    "request_approval",
    "approve",
    "answer_only",
    "dismiss",
  ]),
  oneTimeException: z.boolean().default(false),
  answer: z.string().trim().max(10000).default(""),
  rule: z.string().trim().max(10000).default(""),
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
  { params }: { params: Promise<{ id: string; escalationId: string }> },
) {
  const context = await getExternalAIAnswerContext();
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "The answer is invalid." },
      { status: 400 },
    );
  const { id, escalationId } = await params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(escalationId).success
  )
    return NextResponse.json({ error: "Invalid escalation." }, { status: 400 });
  const org = context.membership.organization_id;
  const { data: escalation } = await context.supabase
    .from("external_ai_escalations")
    .select(
      "id,question,status,resolution,proposed_rule,is_one_time_exception,assigned_to",
    )
    .eq("id", escalationId)
    .eq("connection_id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (!escalation)
    return NextResponse.json(
      { error: "Escalation not found." },
      { status: 404 },
    );
  if (
    !["owner", "admin"].includes(context.membership.permission_level) &&
    escalation.assigned_to !== context.user.id
  )
    return NextResponse.json(
      { error: "This question is assigned to another person." },
      { status: 403 },
    );
  try {
    const answer = parsed.data.answer || escalation.resolution || "";
    if (!answer && parsed.data.action !== "dismiss")
      return NextResponse.json(
        { error: "Write an answer first." },
        { status: 400 },
      );
    if (parsed.data.action === "suggest") {
      if (parsed.data.oneTimeException || escalation.is_one_time_exception)
        return NextResponse.json(
          {
            error:
              "Save this as an answer only. One-time exceptions cannot become company policy.",
          },
          { status: 400 },
        );
      if (escalation.status !== "open")
        return NextResponse.json(
          { error: "This escalation is already answered." },
          { status: 409 },
        );
      const suggested = await suggestRuleFromOwnerAnswer(
        escalation.question,
        answer,
        parsed.data.clarificationAnswers,
      );
      const { data: saved, error } = await context.supabase.rpc(
        "submit_external_human_answer",
        {
          target_organization_id: org,
          target_connection_id: id,
          target_escalation_id: escalationId,
          answer_action: "save_draft",
          answer_text: answer,
          proposal_content: suggested.rule,
          one_time_exception: false,
        },
      );
      if (error) throw error;
      if (!saved)
        return NextResponse.json(
          { error: "This escalation changed. Refresh before continuing." },
          { status: 409 },
        );
      return NextResponse.json({
        title: suggested.title,
        rule: suggested.rule,
        complete: suggested.complete,
        clarificationQuestions: suggested.clarification_questions,
      });
    }
    // Legacy clients' "approve" now requests review, never directly publishes policy.
    const { data, error } = await context.supabase.rpc(
      "submit_external_human_answer",
      {
        target_organization_id: org,
        target_connection_id: id,
        target_escalation_id: escalationId,
        answer_action:
          parsed.data.action === "approve"
            ? "request_approval"
            : parsed.data.action,
        answer_text: answer,
        proposal_content: parsed.data.rule,
        one_time_exception: parsed.data.oneTimeException,
      },
    );
    if (error) {
      const status =
        error.code === "42501"
          ? 403
          : error.code === "P0002"
            ? 404
            : error.code === "40001"
              ? 409
              : ["23514", "22023"].includes(error.code)
                ? 400
                : 500;
      if (status !== 500)
        return NextResponse.json({ error: error.message }, { status });
      throw error;
    }
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error, "The owner answer could not be saved.");
  }
}
