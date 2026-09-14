import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { embedKnowledge, suggestRuleFromOwnerAnswer } from "@/lib/ai/services";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";

const schema = z.object({
  action: z.enum(["suggest", "approve", "answer_only", "dismiss"]),
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
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "The answer is invalid." },
      { status: 400 },
    );
  const { id, escalationId } = await params;
  const org = context.membership.organization_id;
  const { data: escalation } = await context.supabase
    .from("external_ai_escalations")
    .select("id,question,status,resolution,proposed_rule,cluster_id")
    .eq("id", escalationId)
    .eq("connection_id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (!escalation)
    return NextResponse.json(
      { error: "Escalation not found." },
      { status: 404 },
    );
  try {
    if (parsed.data.action === "dismiss") {
      const { error } = await context.supabase
        .from("external_ai_escalations")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", escalationId)
        .eq("organization_id", org);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const answer = parsed.data.answer || escalation.resolution || "";
    if (!answer)
      return NextResponse.json(
        { error: "Write an answer first." },
        { status: 400 },
      );
    if (parsed.data.action === "suggest") {
      const suggested = await suggestRuleFromOwnerAnswer(
        escalation.question,
        answer,
        parsed.data.clarificationAnswers,
      );
      const { error } = await context.supabase
        .from("external_ai_escalations")
        .update({ resolution: answer, proposed_rule: suggested.rule })
        .eq("id", escalationId)
        .eq("organization_id", org);
      if (error) throw error;
      return NextResponse.json({
        title: suggested.title,
        rule: suggested.rule,
        complete: suggested.complete,
        clarificationQuestions: suggested.clarification_questions,
      });
    }
    if (parsed.data.action === "approve") {
      const ruleText = parsed.data.rule || escalation.proposed_rule;
      if (!ruleText)
        return NextResponse.json(
          { error: "Add a reusable rule before approving." },
          { status: 400 },
        );
      const title = escalation.question.slice(0, 120);
      const { data: rule, error: ruleError } = await context.supabase
        .from("process_rules")
        .insert({
          organization_id: org,
          process_id: null,
          title,
          text: ruleText,
          status: "approved",
          created_by: context.user.id,
          approved_by: context.user.id,
          approved_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (ruleError) throw ruleError;
      const [embedding] = await embedKnowledge([`${title}: ${ruleText}`]);
      const now = new Date().toISOString();
      const { data: chunk, error: knowledgeError } = await context.supabase
        .from("knowledge_chunks")
        .insert({
          organization_id: org,
          content: `${title}: ${ruleText}`,
          embedding,
          source_type: "owner_answer",
          source_id: escalation.id,
          rule_id: rule.id,
          approved: true,
          last_confirmed_at: now,
          current_version: 1,
        })
        .select("id")
        .single();
      if (knowledgeError) throw knowledgeError;
      const { error: versionError } = await context.supabase
        .from("knowledge_versions")
        .insert({
          organization_id: org,
          knowledge_chunk_id: chunk.id,
          version_number: 1,
          title,
          content: `${title}: ${ruleText}`,
          changed_by: context.user.id,
          change_reason: "Remembered from an AI connection question",
        });
      if (versionError) throw versionError;
      if (escalation.cluster_id)
        await context.supabase
          .from("question_clusters")
          .update({ status: "resolved" })
          .eq("id", escalation.cluster_id)
          .eq("organization_id", org);
    }
    const { error } = await context.supabase
      .from("external_ai_escalations")
      .update({
        resolution: answer,
        proposed_rule: parsed.data.rule || escalation.proposed_rule,
        status: "answered",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", escalationId)
      .eq("organization_id", org);
    if (error) throw error;
    return NextResponse.json({
      ok: true,
      learned: parsed.data.action === "approve",
    });
  } catch (error) {
    return apiError(error, "The owner answer could not be saved.");
  }
}
