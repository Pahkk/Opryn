import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import {
  ProposalResolutionError,
  rejectKnowledgeProposal,
} from "@/lib/opryn/knowledge/proposals";

const schema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().min(10).max(64),
  reason: z.string().trim().max(1000).optional(),
  answerOnly: z.boolean().optional().default(false),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin)
  )
    return NextResponse.json(
      { error: "Open this review in Opryn." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json(
      { error: "That decision is not valid." },
      { status: 400 },
    );
  const { id } = await params;
  try {
    const result = await rejectKnowledgeProposal({
      service: context.supabase,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      proposalId: id,
      reason: parsed.data.reason,
      answerOnly: parsed.data.answerOnly,
      rejectionSource: "web",
      expectedVersion: parsed.data.version,
      expectedUpdatedAt: parsed.data.updatedAt,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ProposalResolutionError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        {
          status:
            error.code === "not_found"
              ? 404
              : error.code === "rate_limited"
                ? 429
                : 409,
        },
      );
    return apiError(
      error,
      "Opryn couldn't save that decision. Please try again.",
    );
  }
}
