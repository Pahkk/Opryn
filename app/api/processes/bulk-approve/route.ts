import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import {
  approveProcessKnowledge,
  assessProcessApprovalRisk,
} from "@/lib/opryn/processes/approval";

export const maxDuration = 300;

const schema = z.object({
  processIds: z.array(z.string().uuid()).min(1).max(10),
});

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose up to 10 processes to approve." },
      { status: 400 },
    );
  const approved: string[] = [];
  const reviewRequired: Array<{ id: string; reasons: string[] }> = [];
  try {
    for (const processId of [...new Set(parsed.data.processIds)]) {
      const risk = await assessProcessApprovalRisk(
        context.supabase,
        context.membership.organization_id,
        processId,
      );
      if (risk.critical || risk.unresolvedClarifications) {
        reviewRequired.push({ id: processId, reasons: risk.reasons });
        continue;
      }
      await approveProcessKnowledge({
        service: context.supabase,
        organizationId: context.membership.organization_id,
        userId: context.user.id,
        processId,
      });
      approved.push(processId);
    }
    return NextResponse.json({ approved, reviewRequired });
  } catch (error) {
    return apiError(error, "Opryn couldn't finish the selected approvals.");
  }
}
