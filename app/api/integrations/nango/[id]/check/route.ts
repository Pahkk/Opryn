import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { ConnectionError } from "@/lib/integrations/nango";
import { requireNangoCapability } from "@/lib/integrations/nango-capabilities";
import {
  importProviderSource,
  storedSourceSelect,
  type StoredSource,
  sourceFailureStatus,
} from "@/lib/integrations/source-import";

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const { id } = await params;
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "sync_source_updates",
    );
    if (
      connection.provider !== "notion" &&
      connection.provider !== "confluence" &&
      connection.provider !== "google_drive"
    )
      throw new ConnectionError(
        "This provider does not support source checks.",
        400,
      );
    const db = createServiceClient();
    const selected = await db
      .from("integration_sources")
      .select(storedSourceSelect())
      .eq("organization_id", context.membership.organization_id)
      .eq("integration_id", id)
      .in("sync_status", ["imported", "changed", "unavailable", "error"])
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(20);
    if (selected.error) throw selected.error;
    const results = [];
    for (const source of (selected.data ?? []) as unknown as StoredSource[]) {
      try {
        const result = await importProviderSource({
          db,
          organizationId: context.membership.organization_id,
          userId: context.user.id,
          integrationId: id,
          source,
          onlyIfChanged: true,
        });
        results.push({ sourceId: source.id, ...result });
      } catch (error) {
        const failure = sourceFailureStatus(error);
        const saved = await db
          .from("integration_sources")
          .update({
            sync_status: failure,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", source.id)
          .eq("organization_id", context.membership.organization_id);
        if (saved.error) throw saved.error;
        results.push({
          sourceId: source.id,
          changed: false,
          unavailable: failure === "unavailable",
          retryable: failure === "error",
        });
      }
    }
    return NextResponse.json({
      checked: results.filter((row) => !("busy" in row && row.busy)).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ConnectionError
            ? error.message
            : "Source updates could not be checked.",
      },
      { status: error instanceof ConnectionError ? error.status : 503 },
    );
  }
}
