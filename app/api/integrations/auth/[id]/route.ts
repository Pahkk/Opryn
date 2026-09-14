import { NextResponse } from "next/server";
import { apiError, getRequestContext } from "@/lib/api";
import { disconnectIntegration } from "@/lib/integrations/service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    const { id } = await params;
    await disconnectIntegration({
      supabase: context.supabase,
      integrationId: id,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
    });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return apiError(error, "Opryn couldn't disconnect this account.");
  }
}
