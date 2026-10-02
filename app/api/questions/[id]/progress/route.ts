import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { getQuestionProgress } from "@/lib/opryn/knowledge/question-progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid question." }, { status: 400 });
  try {
    const progress = await getQuestionProgress({
      session: context.supabase,
      service: createServiceClient(),
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      questionId: id,
    });
    return NextResponse.json(progress ?? { error: "Question not found." }, {
      status: progress ? 200 : 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(
      error,
      "Question progress could not be checked. Please retry.",
    );
  }
}
