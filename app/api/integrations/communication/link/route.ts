import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashCommunicationToken } from "@/lib/communication/crypto";

const schema = z.object({ token: z.string().min(20).max(200) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "This connection link is invalid." },
      { status: 400 },
    );
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json(
      { error: "Sign in before connecting this account." },
      { status: 401 },
    );
  const service = createServiceClient();
  const { data: link } = await service
    .from("communication_link_tokens")
    .select(
      "id,organization_id,integration_id,provider_user_id,expires_at,used_at",
    )
    .eq("token_hash", hashCommunicationToken(parsed.data.token))
    .maybeSingle();
  if (
    !link ||
    link.used_at ||
    new Date(link.expires_at).getTime() <= Date.now()
  )
    return NextResponse.json(
      { error: "This connection link has expired." },
      { status: 410 },
    );
  const { data: membership } = await service
    .from("organization_members")
    .select("id")
    .eq("organization_id", link.organization_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership)
    return NextResponse.json(
      { error: "This account is not a member of that Opryn workspace." },
      { status: 403 },
    );
  const { error } = await service.from("communication_user_mappings").upsert(
    {
      organization_id: link.organization_id,
      integration_id: link.integration_id,
      provider_user_id: link.provider_user_id,
      opryn_user_id: auth.user.id,
    },
    { onConflict: "integration_id,provider_user_id" },
  );
  if (error)
    return NextResponse.json(
      { error: "Opryn couldn't connect this account." },
      { status: 409 },
    );
  await service
    .from("communication_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", link.id)
    .is("used_at", null);
  return NextResponse.json({ ok: true });
}
