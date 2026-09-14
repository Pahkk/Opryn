import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("confirm_knowledge"),
    knowledgeId: z.string().uuid(),
    version: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("needs_update"),
    knowledgeId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("resolve_feedback"),
    feedbackId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("dismiss_cluster"),
    clusterId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("resolve_conflict"),
    conflictId: z.string().uuid(),
    resolution: z.enum(["use_first", "use_second", "keep_both"]),
  }),
  z.object({
    action: z.literal("set_criticality"),
    knowledgeId: z.string().uuid(),
    criticality: z.enum(["normal", "critical"]),
  }),
]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin)
  )
    return NextResponse.json(
      { error: "Open this review in Opryn to continue." },
      { status: 403 },
    );
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Reload this review and try again." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const organizationId = membership.organization_id;
  const action = parsed.data;
  try {
    if (
      action.action === "confirm_knowledge" ||
      action.action === "resolve_conflict"
    ) {
      const result =
        action.action === "confirm_knowledge"
          ? await supabase.rpc("confirm_company_knowledge", {
              target_organization_id: organizationId,
              target_chunk_id: action.knowledgeId,
              expected_version: action.version,
            })
          : await supabase.rpc("resolve_company_knowledge_conflict", {
              target_organization_id: organizationId,
              target_conflict_id: action.conflictId,
              decision: action.resolution,
            });
      if (result.error) {
        if (result.error.code === "53300")
          return NextResponse.json(
            { error: "Please wait a minute before reviewing more items." },
            { status: 429, headers: { "Retry-After": "60" } },
          );
        if (["40001", "23514", "P0002"].includes(result.error.code))
          return NextResponse.json(
            {
              error:
                action.action === "confirm_knowledge"
                  ? "This knowledge changed or has a conflict. Reload and review it before confirming."
                  : "Review both sources and choose a policy. Conflicting rules cannot both remain official.",
            },
            { status: 409 },
          );
        throw result.error;
      }
    } else if (
      action.action === "resolve_feedback" ||
      action.action === "dismiss_cluster"
    ) {
      const result =
        action.action === "resolve_feedback"
          ? await supabase
              .from("knowledge_feedback")
              .update({
                status: "resolved",
                resolved_at: new Date().toISOString(),
              })
              .eq("id", action.feedbackId)
              .eq("organization_id", organizationId)
              .eq("status", "open")
              .select("id")
              .maybeSingle()
          : await supabase
              .from("question_clusters")
              .update({ status: "dismissed" })
              .eq("id", action.clusterId)
              .eq("organization_id", organizationId)
              .eq("status", "open")
              .select("id")
              .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        return NextResponse.json(
          { error: "This item has already been reviewed." },
          { status: 409 },
        );
    } else {
      const result = await supabase
        .from("knowledge_chunks")
        .update(
          action.action === "needs_update"
            ? { health_status: "needs_review" }
            : { criticality: action.criticality },
        )
        .eq("id", action.knowledgeId)
        .eq("organization_id", organizationId)
        .neq("health_status", "conflict")
        .select("id")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data)
        return NextResponse.json(
          { error: "Review this item's conflict before updating it." },
          { status: 409 },
        );
      const event = await supabase
        .from("knowledge_events")
        .insert({
          organization_id: organizationId,
          event_type: "knowledge_updated",
          actor_id: user.id,
          knowledge_chunk_id: action.knowledgeId,
          metadata:
            action.action === "set_criticality"
              ? { criticality: action.criticality }
              : { review_requested: true },
        });
      if (event.error) throw event.error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't save that review. Please try again.",
    );
  }
}
