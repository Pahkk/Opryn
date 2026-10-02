import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchExternalKnowledgeWithEmbedding } from "@/lib/external-ai/service";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import {
  connectionPermitsKnowledge,
  type ImpactKnowledge,
} from "@/lib/opryn/knowledge/impact";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
import {
  testCompanyAnswer,
  type TestResult,
} from "@/lib/opryn/knowledge/testbench";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import { knowledgeTitle } from "./model";
const responseSchema = z.object({
  answer: z.string().min(1).max(12000),
  sources: z
    .array(z.object({ id: z.uuid(), version: z.number().int().positive() }))
    .max(20),
});
export type SubmittedResult = TestResult & {
  deterministicFailure?: "used_restricted_knowledge" | "outdated_guidance";
  declaredSources?: Array<{ id: string; version: number }>;
};
/** Authorize declared citations before reading their content. Provider output is observable, untrusted evidence. */
export async function submittedAgentResult(
  db: SupabaseClient,
  run: {
    organization_id: string;
    connection_id: string;
    origin_api_key_id: string;
    submitted_response: unknown;
  },
  test: { question: string; context: unknown },
): Promise<SubmittedResult> {
  const payload = responseSchema.parse(run.submitted_response);
  const org = run.organization_id;
  const base = {
    question: test.question,
    answer: payload.answer,
    missingContext: [],
    sources: [],
    testedAt: new Date().toISOString(),
    access:
      "Submitted external agent response · verified connection permissions",
    declaredSources: payload.sources,
  };
  const [connection, scopes, grants, key, plan] = await Promise.all([
    db
      .from("external_ai_connections")
      .select("id,name,status,knowledge_mode,knowledge_policy")
      .eq("organization_id", org)
      .eq("id", run.connection_id)
      .maybeSingle(),
    db
      .from("external_ai_scopes")
      .select("scope")
      .eq("organization_id", org)
      .eq("connection_id", run.connection_id),
    db
      .from("external_ai_knowledge_access")
      .select("connection_id,source_type,source_id")
      .eq("organization_id", org)
      .eq("connection_id", run.connection_id)
      .limit(501),
    db
      .from("external_ai_api_keys")
      .select("id")
      .eq("organization_id", org)
      .eq("connection_id", run.connection_id)
      .eq("id", run.origin_api_key_id)
      .is("revoked_at", null)
      .maybeSingle(),
    getOrganizationPlan(db, org),
  ]);
  for (const r of [connection, scopes, grants, key]) if (r.error) throw r.error;
  const scopeSet = new Set<string>((scopes.data ?? []).map((s) => s.scope));
  if (
    !key.data ||
    connection.data?.status !== "active" ||
    !scopeSet.has("evaluations:create") ||
    !scopeSet.has("knowledge:read") ||
    !hasFeature(plan.plan, "aiConnections")
  )
    return {
      ...base,
      type: "restricted",
      answer: null,
      explanation:
        "Submission access was revoked. No agent response is released.",
    };
  const context = scopeContextSchema.parse(test.context);
  const ids = [...new Set(payload.sources.map((s) => s.id))];
  // Authorization metadata contains no source body; content is read only after grants are checked.
  const metadata = ids.length
    ? await db
        .from("knowledge_chunks")
        .select(
          "id,approved,current_version,process_id,rule_id,role_id,source_id,source_type,library_archived_at,health_status,scope,library_category",
        )
        .eq("organization_id", org)
        .in("id", ids)
    : { data: [], error: null };
  if (metadata.error) throw metadata.error;
  const authorized = (metadata.data ?? []).filter((k) =>
    connectionPermitsKnowledge(
      { ...k, content: "" } as ImpactKnowledge,
      connection.data!.knowledge_mode,
      [...scopeSet],
      grants.data ?? [],
      connection.data!.knowledge_policy,
    ),
  );
  if (
    (grants.data?.length ?? 0) > 500 ||
    ids.some((id) => !authorized.some((k) => k.id === id))
  )
    return {
      ...base,
      type: "answered",
      deterministicFailure: "used_restricted_knowledge",
      explanation:
        "The supplied response declares a citation outside this connection’s authorized knowledge. Restricted source content was not retrieved.",
    };
  // A retrieved policy may cover refunds but omit the requested time-window decision.
  // Reuse the existing grounded answer test to distinguish that gap from agent behavior.
  const coverage = await testCompanyAnswer(db, org, {
    question: test.question,
    context,
    consumer: "connected_ai",
    connectionId: run.connection_id,
  });
  if (coverage.type !== "answered")
    return {
      ...base,
      type: coverage.type,
      explanation: coverage.explanation,
      missingContext: coverage.missingContext,
    };
  const retrieval = await searchExternalKnowledgeWithEmbedding(
    db,
    run.connection_id,
    org,
    test.question,
    15,
    scopeSet,
    context,
  );
  const cited = ids.length
    ? await db
        .from("knowledge_chunks")
        .select("id,content,source_type,source_id,process_id,rule_id,role_id")
        .eq("organization_id", org)
        .in("id", ids)
    : { data: [], error: null };
  if (cited.error) throw cited.error;
  const trusted = await trustedAnswerContext(
    db,
    org,
    (cited.data ?? []) as RetrievedKnowledge[],
    { ...context, channels: ["external_ai"] },
  );
  if (trusted.length !== ids.length)
    return {
      ...base,
      type: "needs_clarification",
      explanation:
        "A declared citation is conflicted, withdrawn or outside this scenario’s scope. Review the knowledge before evaluating behavior.",
    };
  const knowledge = [
    ...retrieval.knowledge,
    ...trusted.filter((k) => !retrieval.knowledge.some((r) => r.id === k.id)),
  ];
  if (!knowledge.length)
    return {
      ...base,
      type: "unknown",
      explanation:
        "No approved guidance is available under the agent’s permissions for this scenario. Ask the right person before attributing an agent failure.",
    };
  const versions = await db
    .from("knowledge_chunks")
    .select("id,current_version")
    .eq("organization_id", org)
    .in(
      "id",
      knowledge.map((k) => k.id),
    );
  if (versions.error) throw versions.error;
  const sources = knowledge.map((k) => ({
    id: k.id,
    title: knowledgeTitle(k),
    source: k.source_type,
    version: versions.data?.find((v) => v.id === k.id)?.current_version ?? 0,
    status: "Approved",
  }));
  if (
    payload.sources.some(
      (s) =>
        metadata.data?.find((k) => k.id === s.id)?.current_version !==
        s.version,
    )
  )
    return {
      ...base,
      type: "answered",
      sources,
      deterministicFailure: "outdated_guidance",
      explanation:
        "The response declares an outdated knowledge version. Supply a new response grounded in the current guidance.",
    };
  return {
    ...base,
    type: "answered",
    sources,
    explanation:
      "Observable provider response evaluated against current authorized guidance. Tool behavior and uncited internal context are not observable.",
  };
}
