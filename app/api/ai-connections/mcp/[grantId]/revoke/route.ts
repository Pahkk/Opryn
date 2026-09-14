import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ grantId: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { grantId } = await params;
  const service = createServiceClient();
  const { data: grant } = await service
    .from("mcp_oauth_grants")
    .select("id")
    .eq("id", grantId)
    .eq("organization_id", context.membership.organization_id)
    .maybeSingle();
  if (!grant)
    return Response.json({ error: "Connection not found." }, { status: 404 });
  const revokedAt = new Date().toISOString();
  const [{ error: grantError }, { error: tokenError }] = await Promise.all([
    service
      .from("mcp_oauth_grants")
      .update({ revoked_at: revokedAt })
      .eq("id", grant.id),
    service
      .from("mcp_oauth_tokens")
      .update({ revoked_at: revokedAt })
      .eq("grant_id", grant.id)
      .is("revoked_at", null),
  ]);
  if (grantError || tokenError)
    return Response.json(
      { error: "Connection could not be disconnected." },
      { status: 500 },
    );
  return Response.json({ ok: true });
}
