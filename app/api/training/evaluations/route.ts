import { NextResponse, after } from "next/server";
import { processTrainingEvaluations } from "@/lib/training/evaluations";
export const maxDuration = 300;
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { embedKnowledge } from "@/lib/ai/services";
export async function GET(request: Request) {
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const id = new URL(request.url).searchParams.get("connectionId");
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Choose an agent." }, { status: 400 });
  const r = await ctx.supabase
    .from("agent_evaluation_runs")
    .select("*")
    .eq("organization_id", ctx.membership.organization_id)
    .eq("connection_id", id!)
    .order("created_at", { ascending: false })
    .limit(25);
  if (r.error) return apiError(r.error, "Evaluation history is unavailable.");
  return NextResponse.json({ runs: r.data });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open training in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const p = z
    .object({
      testId: z.uuid(),
      action: z.enum(["queue", "route_gap"]).default("queue"),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success)
    return NextResponse.json(
      { error: "Choose a saved test." },
      { status: 400 },
    );
  try {
    const org = ctx.membership.organization_id;
    const budget = await ctx.supabase.rpc("consume_training_budget", {
      target_org: org,
    });
    if (budget.error) throw budget.error;
    if (!budget.data)
      return NextResponse.json(
        { error: "Please wait a minute before starting another evaluation." },
        { status: 429 },
      );
    if (p.data.action === "queue") {
      const r = await ctx.supabase.rpc("queue_agent_training_test", {
        target_org: org,
        target_test: p.data.testId,
      });
      if (r.error) throw r.error;
      after(() => processTrainingEvaluations(createServiceClient(), 1));
      return NextResponse.json(
        {
          runId: r.data,
          message: "Evaluation queued. The background worker will run it.",
        },
        { status: 202 },
      );
    }
    const db = createServiceClient();
    const t = await db
      .from("knowledge_test_cases")
      .select(
        "id,question,context,connection_id,last_result,last_agent_result,agent_response_required,agent_response_needs_update,needs_rerun",
      )
      .eq("organization_id", org)
      .eq("id", p.data.testId)
      .is("retired_at", null)
      .maybeSingle();
    if (t.error) throw t.error;
    const currentResult = t.data?.agent_response_required
      ? t.data.last_agent_result
      : t.data?.last_result;
    if (
      !t.data ||
      currentResult?.trainingStatus !== "knowledge_gap" ||
      t.data?.needs_rerun ||
      t.data?.agent_response_needs_update
    )
      return NextResponse.json(
        { error: "This test does not have a current knowledge gap." },
        { status: 409 },
      );
    const key = await db
      .from("external_ai_api_keys")
      .select("id")
      .eq("organization_id", org)
      .eq("connection_id", t.data.connection_id)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (key.error) throw key.error;
    if (!key.data)
      return NextResponse.json(
        { error: "Reconnect this agent before routing its question." },
        { status: 409 },
      );
    const [embedding] = await embedKnowledge([t.data.question]);
    const gap = await db.rpc("record_external_gap", {
      target_organization_id: org,
      target_connection_id: t.data.connection_id,
      target_key_id: key.data.id,
      question_text: t.data.question,
      question_context: `Training evaluation ${t.data.id}`,
      question_embedding: embedding,
      route_question: true,
      register_occurrence: false,
      applicability_context: t.data.context,
    });
    if (gap.error) throw gap.error;
    return NextResponse.json({
      gapId: gap.data.id,
      href: `/app/needs-you?item=external-question-${gap.data.id}`,
      routed: gap.data.routed,
    });
  } catch (e) {
    return apiError(
      e,
      "The evaluation action could not complete. Check connection access and escalation permissions.",
    );
  }
}
