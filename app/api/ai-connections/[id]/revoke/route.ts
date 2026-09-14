import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  const { error } = await context.supabase
    .from("external_ai_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("connection_id", id)
    .eq("organization_id", context.membership.organization_id)
    .is("revoked_at", null);
  if (error) return apiError(error, "The API key could not be revoked.");
  return NextResponse.json({ ok: true });
}
