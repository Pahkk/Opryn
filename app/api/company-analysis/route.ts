import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { analyzeSelectedCompanySources } from "@/lib/opryn/company-analysis";
export const maxDuration = 300;
export async function GET() {
  const c = await getRequestContext({ admin: true });
  if ("error" in c) return c.error;
  const r = await c.supabase
    .from("company_analysis_runs")
    .select("id,status,result,created_at,finished_at")
    .eq("organization_id", c.membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error) return apiError(r.error, "Analysis could not be loaded.");
  return NextResponse.json(
    {
      run: r.data
        ? {
            ...r.data,
            canRetry:
              r.data.status === "running" &&
              Date.parse(r.data.created_at) < Date.now() - 10 * 60 * 1000,
          }
        : null,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open company analysis in Opryn." },
      { status: 403 },
    );
  const c = await getRequestContext({ admin: true });
  if ("error" in c) return c.error;
  const org = c.membership.organization_id;
  const p = z
    .object({ sourceIds: z.array(z.uuid()).min(1).max(2) })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!p.success || new Set(p.data.sourceIds).size !== p.data.sourceIds.length)
    return NextResponse.json(
      { error: "Choose one or two selected knowledge sources." },
      { status: 400 },
    );
  const start = await c.supabase.rpc("start_company_analysis", {
    target_org: org,
    source_ids_value: p.data.sourceIds,
  });
  if (start.error)
    return NextResponse.json(
      {
        error:
          start.error.code === "40001"
            ? "An analysis is already running. Its result will be saved here."
            : "Sources must be selected, connected and in this workspace.",
      },
      { status: start.error.code === "40001" ? 409 : 400 },
    );
  const db = createServiceClient();
  try {
    const result = await analyzeSelectedCompanySources({
      db,
      authenticated: c.supabase,
      org,
      userId: c.user.id,
      sourceIds: p.data.sourceIds,
      onAIWork: async (active) => {
        const progress = await db
          .from("company_analysis_runs")
          .update({ result: { stage: active ? "extracting" : "checking" } })
          .eq("organization_id", org)
          .eq("id", start.data)
          .eq("status", "running");
        if (progress.error) throw progress.error;
      },
    });
    const state = result.sources.every(
      (s) => s.status === "error" || s.status === "busy",
    )
      ? "failed"
      : result.sources.some((s) => s.status === "error" || s.status === "busy")
        ? "partial"
        : "complete";
    const saved = await db
      .from("company_analysis_runs")
      .update({ status: state, result, finished_at: new Date().toISOString() })
      .eq("organization_id", org)
      .eq("id", start.data)
      .eq("status", "running")
      .select("id")
      .single();
    if (saved.error) throw saved.error;
    return NextResponse.json({
      run: { id: start.data, status: state, result },
    });
  } catch (e) {
    const saved = await db
      .from("company_analysis_runs")
      .update({
        status: "failed",
        result: { interrupted: true },
        finished_at: new Date().toISOString(),
      })
      .eq("organization_id", org)
      .eq("id", start.data)
      .eq("status", "running");
    if (saved.error)
      return apiError(
        saved.error,
        "Analysis results could not be saved. Existing source findings are preserved in Needs You.",
      );
    return apiError(
      e,
      "Analysis could not finish. Any prepared findings are preserved in Needs You.",
    );
  }
}
