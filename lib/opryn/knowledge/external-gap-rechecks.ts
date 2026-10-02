import { hasFeature } from "@/lib/billing/plans";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import {
  answerExternalQuestion,
  searchExternalKnowledgeWithEmbedding,
} from "@/lib/external-ai/service";

/** Uses the original connection/key, never the approving administrator's access. */
export async function recheckExternalGapAnswers(
  service: SupabaseClient,
  organizationId: string,
  proposalId: string,
  automatic = false,
) {
  const { data: proposal, error: proposalError } = await service
    .from("knowledge_proposals")
    .select("status,approved_knowledge_id")
    .eq("id", proposalId)
    .eq("organization_id", organizationId)
    .single();
  if (proposalError) throw proposalError;
  if (proposal.status !== "approved")
    throw new Error("Approve the proposal first.");
  const { data: jobs, error: claimError } = await service.rpc(
    automatic ? "claim_scheduled_gap_rechecks" : "claim_external_gap_rechecks",
    {
      target_organization_id: organizationId,
      target_proposal_id: proposalId,
      ...(automatic ? { external_jobs: true } : {}),
    },
  );
  if (claimError) throw claimError;
  const results: Array<{ questionId: string; status: string }> = [];
  for (const job of jobs ?? []) {
    let status: "answered" | "unknown" | "error" = "unknown",
      answerText = "";
    let citations: string[] = [],
      version: number | null = null;
    try {
      const { data: interaction, error } = await service
        .from("external_ai_escalations")
        .select(
          "question,context,connection_id,origin_api_key_id,scope_context",
        )
        .eq("id", job.external_escalation_id)
        .eq("organization_id", organizationId)
        .single();
      if (error) throw error;
      const [connection, key, scopesResult, plan, settingsResult] =
        await Promise.all([
          service
            .from("external_ai_connections")
            .select("status")
            .eq("id", interaction.connection_id)
            .eq("organization_id", organizationId)
            .single(),
          interaction.origin_api_key_id
            ? service
                .from("external_ai_api_keys")
                .select("revoked_at")
                .eq("id", interaction.origin_api_key_id)
                .eq("connection_id", interaction.connection_id)
                .eq("organization_id", organizationId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          service
            .from("external_ai_scopes")
            .select("scope")
            .eq("connection_id", interaction.connection_id)
            .eq("organization_id", organizationId),
          getOrganizationPlan(service, organizationId),
          service
            .from("organization_settings")
            .select("confidence_threshold")
            .eq("organization_id", organizationId)
            .maybeSingle(),
        ]);
      if (
        connection.error ||
        key.error ||
        scopesResult.error ||
        settingsResult.error
      )
        throw new Error("Access lookup failed.");
      const scopes = new Set<string>(
        (scopesResult.data ?? []).map((row) => row.scope),
      );
      // Preserve the existing external API entitlement strategy, rather than widening access.
      if (
        connection.data?.status === "active" &&
        key.data &&
        !key.data.revoked_at &&
        hasFeature(plan.plan, "aiConnections") &&
        scopes.has("knowledge:read")
      ) {
        const { knowledge } = await searchExternalKnowledgeWithEmbedding(
          service,
          interaction.connection_id,
          organizationId,
          `${interaction.question}\n${interaction.context ?? ""}`,
          15,
          scopes,
          interaction.scope_context ?? {},
        );
        const chunksResult = knowledge.length
          ? await service
              .from("knowledge_chunks")
              .select("id,current_version,criticality")
              .eq("organization_id", organizationId)
              .in(
                "id",
                knowledge.map((item) => item.id),
              )
          : { data: [], error: null };
        if (chunksResult.error) throw chunksResult.error;
        version =
          chunksResult.data?.find(
            (item) => item.id === proposal.approved_knowledge_id,
          )?.current_version ?? null;
        const answer = knowledge.length
          ? await answerExternalQuestion(
              interaction.question,
              interaction.context,
              knowledge,
            )
          : null;
        const threshold = chunksResult.data?.some(
          (item) => item.criticality === "critical",
        )
          ? Math.max(settingsResult.data?.confidence_threshold ?? 0.72, 0.9)
          : (settingsResult.data?.confidence_threshold ?? 0.72);
        citations = [
          ...new Set(
            (answer?.cited_source_ids ?? []).filter((id) =>
              knowledge.some((item) => item.id === id),
            ),
          ),
        ];
        if (
          answer?.can_answer &&
          answer.confidence >= threshold &&
          answer.answer.trim() &&
          citations.includes(proposal.approved_knowledge_id)
        ) {
          status = "answered";
          answerText = [answer.answer, ...answer.steps, answer.important_note]
            .filter(Boolean)
            .join("\n\n");
        }
      }
    } catch {
      status = "error";
    } // Never persist provider/model error payloads.
    const args = {
      target_organization_id: organizationId,
      target_proposal_id: proposalId,
      target_escalation_id: job.external_escalation_id,
      result_status: status,
      result_answer: answerText,
      result_citations: citations,
      expected_knowledge_version: version,
    };
    const commit = await service.rpc("complete_external_gap_recheck", args);
    if (commit.error?.code === "23514") {
      // Access/source changed during model generation: persist no answer or citations.
      status = "unknown";
      const fallback = await service.rpc("complete_external_gap_recheck", {
        ...args,
        result_status: status,
        result_answer: "",
        result_citations: [],
      });
      if (fallback.error) throw fallback.error;
    } else if (commit.error) throw commit.error;
    results.push({ questionId: job.external_escalation_id, status });
  }
  return results;
}
