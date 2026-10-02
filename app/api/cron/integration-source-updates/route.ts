import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  importProviderSource,
  storedSourceSelect,
  type StoredSource,
  sourceFailureStatus,
} from "@/lib/integrations/source-import";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  const retention = await db.rpc("prune_external_ai_activity");
  if(retention.error) return NextResponse.json({error:"Activity retention could not run"},{status:503});
  const before = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const result = await db
    .from("integration_sources")
    .select(`${storedSourceSelect()},integrations!inner(status,connected_by)`)
    .in("sync_status", ["imported", "changed", "error"])
    .eq("integrations.status", "connected")
    .or(`last_checked_at.is.null,last_checked_at.lt.${before}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(12);
  if (result.error)
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  let checked = 0;
  let proposals = 0;
  for (const raw of result.data ?? []) {
    const row = raw as unknown as StoredSource & {
      integrations: { connected_by: string } | Array<{ connected_by: string }>;
    };
    const integration = Array.isArray(row.integrations)
      ? row.integrations[0]
      : row.integrations;
    try {
      const outcome = await importProviderSource({
        db,
        organizationId: row.organization_id,
        userId: integration.connected_by,
        integrationId: row.integration_id,
        source: row,
        onlyIfChanged: true,
      });
      if (!outcome.busy) checked += 1;
      if ("prepared" in outcome && outcome.prepared) proposals += 1;
    } catch (error) {
      const saved = await db
        .from("integration_sources")
        .update({
          sync_status: sourceFailureStatus(error),
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("organization_id", row.organization_id);
      if (saved.error)
        return NextResponse.json(
          { error: "Storage unavailable" },
          { status: 503 },
        );
    }
  }
  return NextResponse.json({ ok: true, checked, proposals });
}
