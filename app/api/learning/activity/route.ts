import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { reviewLearningPractice } from "@/lib/ai/learning-practice";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { memberScopeContext } from "@/lib/opryn/knowledge/scope-context";
import type { RetrievedKnowledge } from "@/lib/ai/services";
export const maxDuration = 120;
const schema = z
  .object({
    processId: z.uuid(),
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    action: z.enum(["viewed", "acknowledged", "practiced"]),
    response: z.string().trim().min(10).max(3000).optional(),
  })
  .strict();
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open learning in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const p = schema.safeParse(await request.json().catch(() => null));
  if (!p.success || (p.data.action === "practiced" && !p.data.response))
    return NextResponse.json(
      { error: "Choose an assigned process and write a practice response." },
      { status: 400 },
    );
  const org = ctx.membership.organization_id;
  try {
    let feedback;
    if (p.data.action === "practiced") {
      const assignment = await ctx.supabase
        .from("training_assignments")
        .select("id")
        .eq("organization_id", org)
        .eq("user_id", ctx.user.id)
        .eq("process_id", p.data.processId)
        .maybeSingle();
      if (assignment.error) throw assignment.error;
      if (!assignment.data)
        return NextResponse.json(
          { error: "This learning is not assigned to you." },
          { status: 403 },
        );
      const rows = await ctx.supabase
        .from("knowledge_chunks")
        .select(
          "id,content,source_type,source_id,process_id,rule_id,role_id,current_version",
        )
        .eq("organization_id", org)
        .eq("process_id", p.data.processId)
        .eq("approved", true)
        .is("library_archived_at", null)
        .limit(20);
      if (rows.error) throw rows.error;
      const context = await memberScopeContext(
        ctx.supabase,
        org,
        ctx.user.id,
        "employee",
      );
      const trusted = await trustedAnswerContext(
        ctx.supabase,
        org,
        (rows.data ?? []) as unknown as RetrievedKnowledge[],
        context,
      );
      if (!trusted.length)
        return NextResponse.json(
          {
            error:
              "No approved guidance applies to your access/context. Ask Opryn with business context or request review.",
          },
          { status: 409 },
        );
      feedback = await reviewLearningPractice(
        trusted
          .map((k) => k.content)
          .join("\n\n")
          .slice(0, 12000),
        p.data.response!,
      );
      const fresh = await ctx.supabase
        .from("knowledge_chunks")
        .select("id,current_version,content")
        .eq("organization_id", org)
        .in(
          "id",
          trusted.map((k) => k.id),
        );
      if (fresh.error) throw fresh.error;
      const freshContext = await memberScopeContext(
        ctx.supabase,
        org,
        ctx.user.id,
        "employee",
      );
      if (
        trusted.some(
          (k) =>
            !fresh.data?.some(
              (v) =>
                v.id === k.id &&
                v.content === k.content &&
                v.current_version ===
                  rows.data?.find((old) => old.id === k.id)?.current_version,
            ),
        ) ||
        (await trustedAnswerContext(ctx.supabase, org, trusted, freshContext))
          .length !== trusted.length
      )
        return NextResponse.json(
          { error: "Guidance changed during practice. Read it again." },
          { status: 409 },
        );
    }
    const r = await ctx.supabase.rpc("record_learning_activity", {
      target_org: org,
      target_process: p.data.processId,
      expected_updated: p.data.expectedUpdatedAt,
      activity: p.data.action,
    });
    if (r.error) {
      if (["40001", "23514"].includes(r.error.code))
        return NextResponse.json(
          {
            error:
              "Guidance changed or needs review. Read the current approved version first.",
          },
          { status: 409 },
        );
      throw r.error;
    }
    return NextResponse.json({ ok: true, progress: r.data, feedback });
  } catch (e) {
    return apiError(
      e,
      "Learning could not be saved. Your guidance is preserved.",
    );
  }
}
