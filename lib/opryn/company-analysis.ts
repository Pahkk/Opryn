import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  importProviderSource,
  storedSourceSelect,
  sourceFailureStatus,
  type StoredSource,
} from "@/lib/integrations/source-import";
import { getSourceFreshness } from "@/lib/opryn/knowledge/source-freshness";
import { getKnowledgeHealth } from "@/lib/opryn/knowledge/health";
import { getOwnerIntelligence } from "@/lib/opryn/owner-intelligence";
export type AnalysisResult = {
  sources: Array<{
    id: string;
    title: string;
    status: "prepared" | "unchanged" | "busy" | "error";
    processId: string | null;
  }>;
  snapshot: {
    approvedItems: number;
    approvedProcesses: number;
    approvedPolicies: number;
    approvedFAQs: number;
    conflicts: number;
    openGaps: number;
    sourceIssues: number;
    keyPersonDependencies: number;
    readyForReview: number;
    draftRuleCandidates: number;
    limited: boolean;
  };
};
/** Explicit selected source boundary. The existing extractor creates reviewable drafts only. */
export async function analyzeSelectedCompanySources(input: {
  db: SupabaseClient;
  authenticated: SupabaseClient;
  org: string;
  userId: string;
  sourceIds: string[];
  onAIWork?: (active: boolean) => Promise<void>;
}): Promise<AnalysisResult> {
  const { db, authenticated, org, userId, sourceIds } = input;
  const selected = await db
    .from("integration_sources")
    .select(storedSourceSelect())
    .eq("organization_id", org)
    .in("id", sourceIds);
  if (selected.error) throw selected.error;
  if (selected.data?.length !== sourceIds.length)
    throw new Error("Selected sources no longer belong to this workspace.");
  const results: AnalysisResult["sources"] = [];
  for (const s of selected.data as unknown as StoredSource[]) {
    try {
      const r = await importProviderSource({
        db,
        organizationId: org,
        userId,
        integrationId: s.integration_id,
        source: s,
        onlyIfChanged: true,
        onAIWork: input.onAIWork,
      });
      results.push({
        id: s.id,
        title: s.title,
        status: r.busy
          ? "busy"
          : "prepared" in r && r.prepared
            ? "prepared"
            : "unchanged",
        processId: r.processId ?? s.process_id,
      });
    } catch (e) {
      const save = await db
        .from("integration_sources")
        .update({
          sync_status: sourceFailureStatus(e),
          last_checked_at: new Date().toISOString(),
        })
        .eq("organization_id", org)
        .eq("id", s.id);
      if (save.error) throw save.error;
      results.push({
        id: s.id,
        title: s.title,
        status: "error",
        processId: s.process_id,
      });
    }
  }
  const [health, intelligence, freshness, processes, policies, faqs] =
    await Promise.all([
      getKnowledgeHealth(db, org),
      getOwnerIntelligence(authenticated, org),
      getSourceFreshness(db, org),
      db
        .from("processes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("status", "approved")
        .is("library_archived_at", null),
      db
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("approved", true)
        .is("library_archived_at", null)
        .in("source_type", ["rule", "owner_answer"])
        .eq("library_category", "policy"),
      db
        .from("knowledge_chunks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .eq("approved", true)
        .is("library_archived_at", null)
        .eq("source_type", "faq"),
    ]);
  for (const r of [processes, policies, faqs]) if (r.error) throw r.error;
  const pending = results
    .filter((s) => s.status === "prepared" && s.processId)
    .map((s) => s.processId!);
  const rules = pending.length
    ? await db
        .from("process_rules")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .in("process_id", pending)
        .eq("status", "draft")
    : { count: 0, error: null };
  if (rules.error) throw rules.error;
  return {
    sources: results,
    snapshot: {
      approvedItems: health.approvedCount,
      approvedProcesses: processes.count ?? 0,
      approvedPolicies: policies.count ?? 0,
      approvedFAQs: faqs.count ?? 0,
      conflicts: health.conflicts.length,
      openGaps: intelligence.openGaps,
      sourceIssues: freshness.sources.filter((s) => s.reason).length,
      keyPersonDependencies: intelligence.keyPersonDependencies.length,
      readyForReview: pending.length,
      draftRuleCandidates: rules.count ?? 0,
      limited: health.limited || freshness.limited,
    },
  };
}
