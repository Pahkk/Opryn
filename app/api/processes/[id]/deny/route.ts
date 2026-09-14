import { NextResponse } from "next/server";
import { apiError, getRequestContext } from "@/lib/api";
import { rejectProcessKnowledge } from "@/lib/opryn/processes/approval";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  try {
    const result = await rejectProcessKnowledge({
      service: context.supabase,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      processId: id,
      source: "web",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiError(
      error,
      "Opryn couldn't deny that process. Please try again.",
    );
  }
}
