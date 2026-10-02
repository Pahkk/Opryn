import { NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api";
import { approveProcessKnowledge } from "@/lib/opryn/processes/approval";
import { KnowledgeConflictError } from "@/lib/opryn/knowledge/trust";

export const maxDuration = 300;

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  try {
    const result = await approveProcessKnowledge({
      service: context.supabase,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      processId: id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["40001", "23514"].includes(String(error.code))
    )
      return NextResponse.json(
        {
          error:
            "This revision changed, has a conflict, or includes scoped source guidance. Reopen the review; scoped source updates need per-item review.",
          reviewUrl: "/app/needs-you",
        },
        { status: 409 },
      );
    if (error instanceof KnowledgeConflictError)
      return NextResponse.json(
        { error: error.message, reviewUrl: "/app/needs-you?filter=conflict" },
        { status: 409 },
      );
    return apiError(
      error,
      "Your changes are saved. Opryn couldn't prepare the approved answers yet. Please try approval again.",
    );
  }
}
