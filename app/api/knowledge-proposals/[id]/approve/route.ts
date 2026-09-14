import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import {
  approveKnowledgeProposal,
  ProposalResolutionError,
} from "@/lib/opryn/knowledge/proposals";

export const maxDuration = 120;

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
  const parsed = z
    .object({
      version: z.number().int().positive(),
      updatedAt: z.string().min(10).max(64),
      knowledgeVersion: z.number().int().positive().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Refresh this proposal before accepting it." },
      { status: 400 },
    );
  const { id } = await params;
  try {
    const result = await approveKnowledgeProposal({
      service: context.supabase,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      proposalId: id,
      approvalSource: "web",
      expectedKnowledgeVersion: parsed.data.knowledgeVersion,
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
      "Opryn couldn't complete this decision. Your proposal is saved; refresh and try again.",
    );
  }
}
