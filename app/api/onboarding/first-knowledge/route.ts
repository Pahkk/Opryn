import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { embedKnowledge, suggestRuleFromOwnerAnswer } from "@/lib/ai/services";

const clarificationSchema = z
  .array(
    z.object({
      question: z.string().trim().min(1).max(500),
      answer: z.string().trim().min(1).max(3000),
    }),
  )
  .max(3)
  .default([]);
const analyzeSchema = z.object({
  action: z.literal("analyze"),
  question: z.string().trim().min(3).max(4000),
  answer: z.string().trim().min(2).max(10000),
  clarificationAnswers: clarificationSchema,
});
const approveSchema = z.object({
  action: z.literal("approve"),
  question: z.string().trim().min(3).max(4000),
  answer: z.string().trim().min(2).max(10000),
  title: z.string().trim().min(1).max(200),
  rule: z.string().trim().min(2).max(10000),
});
const schema = z.discriminatedUnion("action", [analyzeSchema, approveSchema]);

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Add a common question and the answer you want your team to follow.",
      },
      { status: 400 },
    );
  const { supabase, membership, user } = context;
  const organizationId = membership.organization_id;
  try {
    if (parsed.data.action === "analyze") {
      let suggested = {
        title: "Common team answer",
        rule: parsed.data.answer,
        complete: parsed.data.clarificationAnswers.length > 0,
        clarification_questions: parsed.data.clarificationAnswers.length
          ? ([] as string[])
          : [
              "Does this answer include any important limit, approval, or exception?",
            ],
      };
      try {
        suggested = await suggestRuleFromOwnerAnswer(
          parsed.data.question,
          parsed.data.answer,
          parsed.data.clarificationAnswers,
        );
      } catch (error) {
        console.error("[Opryn onboarding] Rule suggestion fallback", {
          organizationId,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
      await supabase
        .from("organization_onboarding")
        .update({
          first_question: parsed.data.question,
          first_answer: parsed.data.answer,
        })
        .eq("organization_id", organizationId);
      return NextResponse.json({
        title: suggested.title,
        rule: suggested.rule,
        complete: suggested.complete,
        clarificationQuestions: suggested.clarification_questions.slice(0, 1),
      });
    }

    const { data: onboarding } = await supabase
      .from("organization_onboarding")
      .select("first_rule_id,first_knowledge_id")
      .eq("organization_id", organizationId)
      .single();
    if (!onboarding)
      return NextResponse.json(
        { error: "Onboarding setup was not found." },
        { status: 404 },
      );
    if (onboarding.first_rule_id && onboarding.first_knowledge_id)
      return NextResponse.json({
        ruleId: onboarding.first_rule_id,
        knowledgeId: onboarding.first_knowledge_id,
        testQuestion: buildTestQuestion(parsed.data.question, parsed.data.rule),
      });

    const now = new Date().toISOString();
    const { data: rule, error: ruleError } = await supabase
      .from("process_rules")
      .insert({
        organization_id: organizationId,
        process_id: null,
        title: parsed.data.title,
        text: parsed.data.rule,
        status: "approved",
        created_by: user.id,
        approved_by: user.id,
        approved_at: now,
      })
      .select("id")
      .single();
    if (ruleError) throw ruleError;
    const content = `${parsed.data.title}: ${parsed.data.rule}`;
    const [embedding] = await embedKnowledge([content]);
    const { data: knowledge, error: knowledgeError } = await supabase
      .from("knowledge_chunks")
      .insert({
        organization_id: organizationId,
        content,
        embedding,
        source_type: "rule",
        source_id: rule.id,
        rule_id: rule.id,
        approved: true,
        last_confirmed_at: now,
        current_version: 1,
      })
      .select("id")
      .single();
    if (knowledgeError) throw knowledgeError;
    const { error: versionError } = await supabase
      .from("knowledge_versions")
      .insert({
        organization_id: organizationId,
        knowledge_chunk_id: knowledge.id,
        version_number: 1,
        title: parsed.data.title,
        content,
        changed_by: user.id,
        change_reason: "First approved answer during onboarding",
      });
    if (versionError) throw versionError;
    await Promise.all([
      supabase
        .from("organization_onboarding")
        .update({
          current_step: "test",
          completed_steps: [
            "business",
            "goals",
            "knowledge",
            "tools",
            "connections",
            "setup",
            "teach",
          ],
          first_question: parsed.data.question,
          first_answer: parsed.data.answer,
          first_rule_id: rule.id,
          first_knowledge_id: knowledge.id,
        })
        .eq("organization_id", organizationId),
      supabase.from("knowledge_events").insert({
        organization_id: organizationId,
        event_type: "knowledge_approved",
        actor_id: user.id,
        knowledge_chunk_id: knowledge.id,
        metadata: { source: "onboarding", version: 1 },
      }),
      supabase.from("onboarding_events").insert([
        {
          organization_id: organizationId,
          user_id: user.id,
          event_type: "first_knowledge_created",
          metadata: { rule_id: rule.id },
        },
        {
          organization_id: organizationId,
          user_id: user.id,
          event_type: "first_knowledge_approved",
          metadata: { knowledge_id: knowledge.id },
        },
      ]),
    ]);
    return NextResponse.json({
      ruleId: rule.id,
      knowledgeId: knowledge.id,
      testQuestion: buildTestQuestion(parsed.data.question, parsed.data.rule),
    });
  } catch (error) {
    return apiError(error, "Opryn couldn't save this answer. Try again.");
  }
}

function buildTestQuestion(question: string, rule: string) {
  const currency = rule.match(/\$([\d,]+)/);
  if (currency) {
    const limit = Number(currency[1].replaceAll(",", ""));
    const higher = Number.isFinite(limit)
      ? limit + Math.max(100, Math.round(limit * 0.4))
      : 700;
    if (/refund/i.test(`${question} ${rule}`))
      return `Can I approve a $${higher.toLocaleString("en-US")} refund?`;
    if (/discount/i.test(`${question} ${rule}`))
      return `Can I give this customer a $${higher.toLocaleString("en-US")} discount?`;
    return `Can I approve $${higher.toLocaleString("en-US")} in this situation?`;
  }
  const percent = rule.match(/(\d{1,2})\s*%/);
  if (percent)
    return `Can I approve ${Math.min(100, Number(percent[1]) + 5)}%?`;
  return question;
}
