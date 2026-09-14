import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";
import {
  displayKeyPrefix,
  generateAgentCredentials,
  hashAgentKey,
} from "@/lib/external-ai/keys";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  const org = context.membership.organization_id;
  const { data: connection } = await context.supabase
    .from("external_ai_connections")
    .select("id")
    .eq("id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (!connection)
    return NextResponse.json(
      { error: "Connection not found." },
      { status: 404 },
    );
  const { apiKey } = generateAgentCredentials();
  try {
    const now = new Date().toISOString();
    const { error: revokeError } = await context.supabase
      .from("external_ai_api_keys")
      .update({ revoked_at: now })
      .eq("connection_id", id)
      .eq("organization_id", org)
      .is("revoked_at", null);
    if (revokeError) throw revokeError;
    const { error } = await context.supabase
      .from("external_ai_api_keys")
      .insert({
        organization_id: org,
        connection_id: id,
        key_prefix: displayKeyPrefix(apiKey),
        key_hash: hashAgentKey(apiKey),
      });
    if (error) throw error;
    return NextResponse.json(
      { apiKey },
      { headers: { "cache-control": "no-store, private" } },
    );
  } catch (error) {
    return apiError(error, "The API key could not be rotated.");
  }
}
