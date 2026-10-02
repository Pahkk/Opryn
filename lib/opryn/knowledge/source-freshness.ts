import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SourceFreshness = {
  id: string;
  integration_id: string;
  provider: string;
  title: string;
  sync_status: string;
  review_status?: string;
  process_id: string | null;
  approved_process_id: string | null;
  provider_version: string | null;
  modified_at: string | null;
  last_checked_at: string | null;
  last_successful_check_at: string | null;
  last_imported_at: string | null;
  connectionStatus: string;
  reason: string | null;
};
export function sourceFreshnessReason(
  source: Pick<
    SourceFreshness,
    | "connectionStatus"
    | "sync_status"
    | "process_id"
    | "approved_process_id"
    | "last_successful_check_at"
    | "last_imported_at"
    | "review_status"
  >,
  now = Date.now(),
) {
  if (source.connectionStatus !== "connected")
    return "Connection needs attention";
  if (source.sync_status === "unavailable")
    return "Source unavailable or access lost";
  if (source.sync_status === "error")
    return "Last check could not finish — retry available";
  if (source.review_status === "declined")
    return "Latest findings declined — approved guidance retained";
  if (
    source.review_status !== "approved" &&
    source.process_id &&
    source.process_id !== source.approved_process_id
  )
    return "Findings awaiting review";
  const checked = source.last_successful_check_at ?? source.last_imported_at;
  if (!checked) return "Not yet imported";
  if (now - Date.parse(checked) >= 180 * 86400000)
    return "No successful source check in 180 days";
  return null;
}
/** Admin-only caller, service client; returns no credentials or identity metadata. */
export async function getSourceFreshness(db: SupabaseClient, org: string) {
  const result = await db
    .from("integration_sources")
    .select(
      "id,integration_id,provider,title,sync_status,review_status,process_id,approved_process_id,provider_version,modified_at,last_checked_at,last_successful_check_at,last_imported_at,integrations(status)",
    )
    .eq("organization_id", org)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(501);
  if (result.error) throw result.error;
  return {
    limited: (result.data?.length ?? 0) > 500,
    sources: (result.data ?? []).slice(0, 500).map((row) => {
      const raw = row.integrations as unknown as
        { status: string } | { status: string }[] | null;
      const connectionStatus =
        (Array.isArray(raw) ? raw[0] : raw)?.status ?? "unavailable";
      const source = { ...row, connectionStatus };
      return {
        ...source,
        reason: sourceFreshnessReason(source),
      } as SourceFreshness;
    }),
  };
}
