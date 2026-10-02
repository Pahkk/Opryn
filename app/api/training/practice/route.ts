import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { memberScopeContext } from "@/lib/opryn/knowledge/scope-context";
import { reviewLearningPractice } from "@/lib/ai/learning-practice";
import type { RetrievedKnowledge } from "@/lib/ai/services";
export const maxDuration = 120;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open training in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const p = z
    .object({
      assignmentId: z.uuid(),
      version: z.number().int().positive(),
      action: z.enum(["acknowledge", "practice"]),
      response: z.string().trim().min(10).max(3000).optional(),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success || (p.data.action === "practice" && !p.data.response))
    return NextResponse.json(
      { error: "Choose current guidance and add your response." },
      { status: 400 },
    );
  const org = ctx.membership.organization_id;
  try {
    const a = await ctx.supabase
      .from("training_assignments")
      .select("id,knowledge_chunk_id,retired_at")
      .eq("organization_id", org)
      .eq("id", p.data.assignmentId)
      .eq("user_id", ctx.user.id)
      .is("retired_at", null)
      .maybeSingle();
    if (a.error) throw a.error;
    if (!a.data)
      return NextResponse.json(
        { error: "Training is not assigned to you." },
        { status: 403 },
      );
    const k = await ctx.supabase
      .from("knowledge_chunks")
      .select("*")
      .eq("organization_id", org)
      .eq("id", a.data.knowledge_chunk_id)
      .eq("approved", true)
      .is("library_archived_at", null)
      .maybeSingle();
    if (k.error) throw k.error;
    const scope = await memberScopeContext(
      ctx.supabase,
      org,
      ctx.user.id,
      "employee",
    );
    if (
      !k.data ||
      k.data.current_version !== p.data.version ||
      !(
        await trustedAnswerContext(
          ctx.supabase,
          org,
          [k.data as RetrievedKnowledge],
          scope,
        )
      ).length
    )
      return NextResponse.json(
        {
          error:
            "Guidance changed, is restricted, or needs review. Refresh training.",
        },
        { status: 409 },
      );
    const s = await ctx.supabase
      .from("training_scenarios")
      .select("*")
      .eq("organization_id", org)
      .eq("knowledge_chunk_id", k.data.id)
      .eq("knowledge_version", p.data.version)
      .eq("status", "approved")
      .maybeSingle();
    if (s.error) throw s.error;
    if (p.data.action === "practice" && !s.data)
      return NextResponse.json(
        {
          error:
            "A current practice scenario needs review by your administrator.",
        },
        { status: 409 },
      );
    const db = createServiceClient();
    const budget = await ctx.supabase.rpc("consume_training_budget", {
      target_org: org,
    });
    if (budget.error) throw budget.error;
    if (!budget.data)
      return NextResponse.json(
        { error: "Please wait a minute before trying again." },
        { status: 429 },
      );
    const feedback =
      p.data.action === "practice"
        ? await reviewLearningPractice(
            k.data.content,
            p.data.response!,
            s.data.prompt,
          )
        : null;
    const outcome = feedback
      ? feedback.result === "supported"
        ? "supported"
        : feedback.result === "missing_detail"
          ? "practice_needed"
          : "review"
      : "acknowledged";
    const write = await db.rpc("commit_training_attempt", {
      target_org: org,
      target_user: ctx.user.id,
      target_assignment: a.data.id,
      expected_version: p.data.version,
      target_scenario: feedback ? s.data.id : null,
      expected_scenario_revision: feedback ? s.data.revision : null,
      outcome_value: outcome,
      response_value: p.data.response ?? null,
      feedback_value: feedback?.feedback ?? null,
    });
    if (write.error) {
      if (["40001", "42501", "23514"].includes(write.error.code))
        return NextResponse.json(
          {
            error:
              "Guidance or access changed during practice. Refresh and try again.",
          },
          { status: 409 },
        );
      throw write.error;
    }
    return NextResponse.json({ outcome, feedback });
  } catch (e) {
    return apiError(
      e,
      "Practice could not be saved. Your earlier progress is preserved.",
    );
  }
}
