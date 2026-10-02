import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recheckKnowledgeGapAnswers } from "./gap-rechecks";
import { recheckExternalGapAnswers } from "./external-gap-rechecks";

export async function recheckAllKnowledgeGapAnswers(
  service: SupabaseClient,
  organizationId: string,
  proposalId: string,
  automatic = false,
) {
  const team = await recheckKnowledgeGapAnswers(
    service,
    organizationId,
    proposalId,
    automatic,
  );
  const external = await recheckExternalGapAnswers(
    service,
    organizationId,
    proposalId,
    automatic,
  );
  return [...team, ...external];
}

/** Existing daily worker recovers unfinished batches; transient failures cannot starve other proposals. */
export async function processPendingGapRechecks(service: SupabaseClient) {
  const { data: jobs, error } = await service.rpc(
    "list_due_gap_recheck_batches",
  );
  if (error) throw error;
  let processed = 0,
    failed = 0;
  for (const job of jobs ?? []) {
    try {
      processed += (
        await recheckAllKnowledgeGapAnswers(
          service,
          job.organization_id,
          job.proposal_id,
          true,
        )
      ).length;
    } catch {
      failed++;
    }
  }
  return { processed, failed };
}
