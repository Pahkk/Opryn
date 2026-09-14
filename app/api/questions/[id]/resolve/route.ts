import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { compareApprovedKnowledge, embedKnowledge } from "@/lib/ai/services";

const schema = z.object({
  answerId: z.string().uuid(),
  action: z.enum(["approve", "answer_only", "request_approval"]),
  title: z.string().trim().max(200).optional(),
  rule: z.string().trim().max(10000).optional(),
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
      { error: "The answer could not be saved." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const isAdmin = ["owner", "admin"].includes(membership.permission_level);
  const { data: question } = await supabase
    .from("employee_questions")
    .select("id,question,asked_by,status,cluster_id,assigned_expert_id,assigned_expert_rule_id")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!question)
    return NextResponse.json(
      { error: "This question is no longer available." },
      { status: 404 },
    );
  const isAssignedExpert = question.assigned_expert_id === user.id;
  if (!isAdmin && !isAssignedExpert)
    return NextResponse.json(
      { error: "You cannot resolve this question." },
      { status: 403 },
    );

  const { data: answer } = await supabase
    .from("question_answers")
    .select(
      "id,answer,proposed_rule,answer_type,answered_by,approved_as_knowledge",
    )
    .eq("id", parsed.data.answerId)
    .eq("question_id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  if (!answer)
    return NextResponse.json({ error: "Answer not found." }, { status: 404 });

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
  if (parsed.data.action === "approve" && !canApprove)
    return NextResponse.json(
      {
        error: "An owner or admin needs to approve this as company knowledge.",
      },
      { status: 403 },
    );

  try {
    let knowledgeChunkId: string | null = null;
    if (parsed.data.action === "approve" && !answer.approved_as_knowledge) {
      const ruleText = parsed.data.rule || answer.proposed_rule;
      if (!ruleText)
        return NextResponse.json(
          { error: "Add a reusable rule before approving." },
          { status: 400 },
        );
      const title = parsed.data.title || "Company guidance";
      const now = new Date().toISOString();
      const { data: rule, error: ruleError } = await supabase
        .from("process_rules")
        .insert({
          organization_id: membership.organization_id,
          process_id: null,
          title,
          text: ruleText,
          status: "approved",
          created_by: answer.answered_by || user.id,
          approved_by: user.id,
          approved_at: now,
        })
        .select("id")
        .single();
      if (ruleError) throw ruleError;
      const content = `${title}: ${ruleText}`;
      const [embedding] = await embedKnowledge([content]);
      const { data: chunk, error: knowledgeError } = await supabase
        .from("knowledge_chunks")
        .insert({
          organization_id: membership.organization_id,
          content,
          embedding,
          source_type: "owner_answer",
          source_id: answer.id,
          rule_id: rule.id,
          approved: true,
          last_confirmed_at: now,
          current_version: 1,
        })
        .select("id")
        .single();
      if (knowledgeError) throw knowledgeError;
      knowledgeChunkId = chunk.id;
      const { error: versionError } = await supabase
        .from("knowledge_versions")
        .insert({
          organization_id: membership.organization_id,
          knowledge_chunk_id: chunk.id,
          version_number: 1,
          title,
          content,
          changed_by: user.id,
          change_reason: "Remembered from a team question",
        });
      if (versionError) throw versionError;
      try {
        const { data: similar } = await supabase.rpc("match_knowledge", {
          target_organization_id: membership.organization_id,
          query_embedding: embedding,
          target_role_id: membership.role_id,
          match_threshold: 0.72,
          match_count: 8,
        });
        const candidates = (similar ?? [])
          .filter((item: { id: string }) => item.id !== chunk.id)
          .slice(0, 5) as Array<{ id: string; content: string }>;
        const relationships = await compareApprovedKnowledge(
          content,
          candidates,
        );
        const flagged = relationships.filter(
          (item) => item.relationship !== "compatible",
        );
        if (flagged.length) {
          await supabase.from("knowledge_conflicts").insert(
            flagged.map((item) => ({
              organization_id: membership.organization_id,
              knowledge_chunk_a: chunk.id,
              knowledge_chunk_b: item.source_id,
              conflict_type: item.relationship,
              explanation: item.explanation,
            })),
          );
          const hasConflict = flagged.some(
            (item) => item.relationship === "conflict",
          );
          await supabase
            .from("knowledge_chunks")
            .update({
              health_status: hasConflict ? "conflict" : "needs_review",
            })
            .in("id", [chunk.id, ...flagged.map((item) => item.source_id)])
            .eq("organization_id", membership.organization_id);
          await supabase.from("knowledge_events").insert({
            organization_id: membership.organization_id,
            event_type: "knowledge_conflict_detected",
            actor_id: user.id,
            question_id: id,
            knowledge_chunk_id: chunk.id,
            metadata: { count: flagged.length, has_conflict: hasConflict },
          });
        }
      } catch (comparisonError) {
        console.error("Knowledge comparison failed after approval", {
          questionId: id,
          knowledgeChunkId: chunk.id,
          message:
            comparisonError instanceof Error
              ? comparisonError.message
              : "Unknown error",
        });
      }
      await supabase
        .from("question_answers")
        .update({ approved_as_knowledge: true, proposed_rule: ruleText })
        .eq("id", answer.id);
      await supabase.from("knowledge_events").insert({
        organization_id: membership.organization_id,
        event_type: "knowledge_approved",
        actor_id: user.id,
        question_id: id,
        knowledge_chunk_id: chunk.id,
        metadata: { version: 1, source: answer.answer_type },
      });
      if (question.cluster_id)
        await supabase
          .from("question_clusters")
          .update({ status: "resolved" })
          .eq("id", question.cluster_id)
          .eq("organization_id", membership.organization_id);
    }

    if (question.status !== "resolved") {
      const { error: questionError } = await supabase
        .from("employee_questions")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", membership.organization_id);
      if (questionError) throw questionError;
      await supabase.from("notifications").insert({
        organization_id: membership.organization_id,
        user_id: question.asked_by,
        type: "question_answered",
        title: "Your question was answered",
        body: question.question,
        link: "/app/ask",
      });
    }
    return NextResponse.json({
      ok: true,
      learned: parsed.data.action === "approve",
      awaitingApproval: parsed.data.action === "request_approval",
      knowledgeChunkId,
    });
  } catch (error) {
    return apiError(error, "Unable to finish saving this answer.");
  }
}
