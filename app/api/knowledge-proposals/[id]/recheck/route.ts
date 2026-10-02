import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { recheckAllKnowledgeGapAnswers } from "@/lib/opryn/knowledge/recheck-runner";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid proposal." }, { status: 400 });
  const { data: proposal, error } = await context.supabase
    .from("knowledge_proposals")
    .select("status")
    .eq("organization_id", context.membership.organization_id)
    .eq("id", id)
    .maybeSingle();
  if (error) return apiError(error);
  if (!proposal)
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
  if (proposal.status !== "approved")
    return NextResponse.json(
      { error: "Approve this proposal first." },
      { status: 409 },
    );
  try {
    const results = await recheckAllKnowledgeGapAnswers(
      createServiceClient(),
      context.membership.organization_id,
      id,
    );
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't finish the recheck. The approved knowledge is saved; try again.",
    );
  }
}
