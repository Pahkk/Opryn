import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  testCompanyAnswer,
  compareTestExpectation,
} from "@/lib/opryn/knowledge/testbench";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
import { evaluateAgentAnswer } from "./answer-evaluation";
import {
  submittedAgentResult,
  type SubmittedResult,
} from "./submitted-response";
import { classifyEvaluation } from "./model";

export async function evaluationDeadline<T>(
  work: () => Promise<T>,
  milliseconds = 70000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("evaluation_timed_out")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Executes Opryn's authorized response, not a provider-owned agent. Durable leases are SQL-owned. */
export async function processTrainingEvaluations(
  db: SupabaseClient,
  maximum = 2,
) {
  let processed = 0,
    failed = 0;
  for (let i = 0; i < maximum; i++) {
    const claim = await db.rpc("claim_training_evaluation");
    if (claim.error) throw claim.error;
    const run = claim.data?.[0];
    if (!run) break;
    try {
      const [t, c] = await Promise.all([
        db
          .from("knowledge_test_cases")
          .select("*")
          .eq("organization_id", run.organization_id)
          .eq("id", run.test_id)
          .single(),
        db
          .from("external_ai_connections")
          .select("configuration_version,status")
          .eq("organization_id", run.organization_id)
          .eq("id", run.connection_id)
          .single(),
      ]);
      if (t.error || c.error) throw t.error ?? c.error;
      const result = await evaluationDeadline(async () =>
        run.execution_mode === "agent_response"
          ? await submittedAgentResult(db, run, t.data)
          : await testCompanyAnswer(db, run.organization_id, {
              question: t.data.question,
              context: scopeContextSchema.parse(t.data.context),
              consumer: t.data.consumer,
              connectionId: run.connection_id,
            }),
      );
      const comparison = compareTestExpectation(
        result,
        t.data.expected_outcome,
        t.data.expected_knowledge_ids,
      );
      if (run.execution_mode === "agent_response")
        comparison.passed =
          comparison.passed &&
          t.data.expected_knowledge_ids.every((id: string) =>
            (result as SubmittedResult).declaredSources?.some(
              (source) => source.id === id,
            ),
          );
      const knowledge = result.sources.length
        ? await db
            .from("knowledge_chunks")
            .select("id,content,current_version")
            .eq("organization_id", run.organization_id)
            .in(
              "id",
              result.sources.map((s) => s.id),
            )
        : { data: [], error: null };
      if (knowledge.error) throw knowledge.error;
      const deterministicFailure =
        "deterministicFailure" in result ? result.deterministicFailure : null;
      const review =
        !deterministicFailure &&
        result.type === "answered" &&
        result.answer &&
        t.data.expected_behavior
          ? await evaluateAgentAnswer({
              guidance: (knowledge.data ?? [])
                .map((k) => k.content)
                .join("\n\n"),
              response: result.answer,
              question: t.data.question,
              expectedBehavior: t.data.expected_behavior,
            })
          : null;
      let status = classifyEvaluation(
        result.type,
        comparison.passed,
        review?.status === "passed",
      );
      if (
        result.type === "answered" &&
        comparison.passed &&
        review?.status === "failed"
      )
        status = "failed";
      if (deterministicFailure) status = "failed";
      const saved = await db.rpc("finish_training_evaluation", {
        target_run: run.id,
        lease_attempt: run.attempts,
        result_value: {
          ...result,
          comparison,
          review,
          failureCategory:
            deterministicFailure ??
            (result.type === "unknown"
              ? "missing_approved_knowledge"
              : (review?.failureCategory ?? null)),
          failureReason: review?.reason ?? result.explanation,
          trainingStatus: status,
          executionMode: run.execution_mode,
          evaluationVersion: run.evaluation_version,
          configurationVersion: run.configuration_version,
        },
        status_value: status,
      });
      if (saved.error) throw saved.error;
      processed++;
    } catch (error) {
      failed++;
      const retry = await db
        .from("agent_evaluation_runs")
        .update({
          status: run.attempts >= 3 ? "error" : "queued",
          error_code:
            error instanceof Error && error.message === "evaluation_timed_out"
              ? "evaluation_timed_out"
              : "evaluation_unavailable",
          locked_at: null,
          available_at: new Date(
            Date.now() + 60000 * 2 ** run.attempts,
          ).toISOString(),
        })
        .eq("organization_id", run.organization_id)
        .eq("id", run.id)
        .eq("status", "running")
        .eq("attempts", run.attempts);
      if (retry.error) throw retry.error;
      console.error(
        JSON.stringify({
          event: "training_evaluation_error",
          runId: run.id,
          attempt: run.attempts,
        }),
      );
    }
  }
  return { processed, failed };
}
