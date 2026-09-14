import { createServiceClient } from "@/lib/supabase/service";
import { hashOAuthValue } from "@/lib/opryn/oauth/crypto";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const raw = String(form?.get("token") || "");
  if (!raw) return new Response(null, { status: 200 });
  const service = createServiceClient();
  const hash = hashOAuthValue(raw);
  const { data: token } = await service
    .from("mcp_oauth_tokens")
    .select("grant_id")
    .or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`)
    .maybeSingle();
  if (token) {
    const revokedAt = new Date().toISOString();
    await Promise.all([
      service
        .from("mcp_oauth_grants")
        .update({ revoked_at: revokedAt })
        .eq("id", token.grant_id),
      service
        .from("mcp_oauth_tokens")
        .update({ revoked_at: revokedAt })
        .eq("grant_id", token.grant_id)
        .is("revoked_at", null),
    ]);
  }
  return new Response(null, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
