import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  answerCompanyQuestion,
  embedKnowledge,
  type RetrievedKnowledge,
} from "@/lib/ai/services";
import { hasFeature } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { trustedAnswerContext } from "./trust";
import { scopedKnowledgeContext } from "./scoped-context";
import { memberScopeContext } from "./scope-context";
import type { ScopeContext } from "./scope";

export type TestConsumer =
  "employee" | "new_hire" | "connected_ai" | "support_bot" | "call_agent";
export type TestOutcome =
  "answered" | "unknown" | "conflict" | "needs_clarification" | "restricted";
export type TestResult = {
  question: string;
  type: TestOutcome;
  answer: string | null;
  explanation: string;
  missingContext: string[];
  access: string;
  sources: Array<{
    id: string;
    title: string;
    source: string;
    version: number;
    status: string;
  }>;
  testedAt: string;
};
const externalSourceTypes = [
  "role_instruction",
  "call_finding",
  "faq",
  "google_drive",
  "video_finding",
];

/** Side-effect-free simulation. No questions, gaps, notifications, sends or usage events. */
export async function testCompanyAnswer(
  service: SupabaseClient,
  org: string,
  input: {
    question: string;
    context: ScopeContext;
    consumer: TestConsumer;
    actorId?: string;
    connectionId?: string;
  },
): Promise<TestResult> {
  const base = {
    question: input.question,
    answer: null,
    missingContext: [] as string[],
    sources: [] as TestResult["sources"],
    testedAt: new Date().toISOString(),
  };
  let context: ScopeContext = input.context;
  let candidates: RetrievedKnowledge[];
  let access: string;
  let verifyAccess: () => Promise<string[]>;
  const settings = await service
    .from("organization_settings")
    .select("employees_can_ask,confidence_threshold")
    .eq("organization_id", org)
    .maybeSingle();
  if (settings.error) throw settings.error;
  if (input.consumer === "employee" || input.consumer === "new_hire") {
    if (!input.actorId)
      return {
        ...base,
        type: "restricted",
        access: "Member unavailable",
        explanation:
          "The saved test's member no longer exists, or no actual member was selected.",
      };
    const member = await service
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org)
      .eq("user_id", input.actorId)
      .maybeSingle();
    if (member.error) throw member.error;
    if (!member.data || settings.data?.employees_can_ask === false)
      return {
        ...base,
        type: "restricted",
        access: "Member access unavailable",
        explanation:
          "The selected member cannot use Ask Opryn in this workspace.",
      };
    context = await memberScopeContext(
      service,
      org,
      input.actorId,
      "employee",
      input.context,
    );
    const [embedding] = await embedKnowledge([input.question]);
    const result = await service.rpc("match_knowledge_for_communication", {
      target_organization_id: org,
      target_user_id: input.actorId,
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 15,
    });
    if (result.error) throw result.error;
    candidates = (result.data ?? []) as RetrievedKnowledge[];
    verifyAccess = async () => {
      const fresh = await service.rpc("match_knowledge_for_communication", {
        target_organization_id: org,
        target_user_id: input.actorId,
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 15,
      });
      if (fresh.error) throw fresh.error;
      return (fresh.data ?? []).map((k: { id: string }) => k.id);
    };
    access = "Actual selected member permissions · employee channel";
  } else {
    if (!input.connectionId)
      return {
        ...base,
        type: "restricted",
        access: "Connection unavailable",
        explanation:
          "The saved test's connection no longer exists, or no actual connection was selected.",
      };
    const [connection, scopes, plan] = await Promise.all([
      service
        .from("external_ai_connections")
        .select("status,name")
        .eq("organization_id", org)
        .eq("id", input.connectionId)
        .maybeSingle(),
      service
        .from("external_ai_scopes")
        .select("scope")
        .eq("organization_id", org)
        .eq("connection_id", input.connectionId),
      getOrganizationPlan(service, org),
    ]);
    if (connection.error || scopes.error)
      throw connection.error ?? scopes.error;
    const allowed = new Set((scopes.data ?? []).map((r) => r.scope));
    if (
      !connection.data ||
      connection.data.status !== "active" ||
      !hasFeature(plan.plan, "aiConnections") ||
      !allowed.has("knowledge:read")
    )
      return {
        ...base,
        type: "restricted",
        access: "Connection access unavailable",
        explanation:
          "The actual connection, knowledge-read scope and existing external API entitlement must be active.",
      };
    const sourceTypes = [...externalSourceTypes];
    if (allowed.has("policies:read")) sourceTypes.push("rule", "owner_answer");
    if (allowed.has("processes:read"))
      sourceTypes.push("process_summary", "process_step", "exception");
    context = { ...input.context, channels: ["external_ai"] };
    const [embedding] = await embedKnowledge([input.question]);
    const result = await service.rpc("match_external_ai_knowledge", {
      target_organization_id: org,
      target_connection_id: input.connectionId,
      query_embedding: embedding,
      target_source_types: sourceTypes,
      match_threshold: 0.3,
      match_count: 15,
    });
    if (result.error) throw result.error;
    candidates = (result.data ?? []) as RetrievedKnowledge[];
    verifyAccess = async () => {
      const [freshConnection, freshScopes, freshPlan] = await Promise.all([
        service
          .from("external_ai_connections")
          .select("status")
          .eq("organization_id", org)
          .eq("id", input.connectionId!)
          .maybeSingle(),
        service
          .from("external_ai_scopes")
          .select("scope")
          .eq("organization_id", org)
          .eq("connection_id", input.connectionId!),
        getOrganizationPlan(service, org),
      ]);
      if (freshConnection.error || freshScopes.error)
        throw freshConnection.error ?? freshScopes.error;
      const activeScopes = new Set(
        (freshScopes.data ?? []).map((r) => r.scope),
      );
      if (
        freshConnection.data?.status !== "active" ||
        !hasFeature(freshPlan.plan, "aiConnections") ||
        !activeScopes.has("knowledge:read")
      )
        return [];
      const types = [...externalSourceTypes];
      if (activeScopes.has("policies:read")) types.push("rule", "owner_answer");
      if (activeScopes.has("processes:read"))
        types.push("process_summary", "process_step", "exception");
      const fresh = await service.rpc("match_external_ai_knowledge", {
        target_organization_id: org,
        target_connection_id: input.connectionId,
        query_embedding: embedding,
        target_source_types: types,
        match_threshold: 0.3,
        match_count: 15,
      });
      if (fresh.error) throw fresh.error;
      return (fresh.data ?? []).map((k: { id: string }) => k.id);
    };
    access = `Actual ${connection.data.name} access policy · external API response simulation`;
  }
  const scoped = await scopedKnowledgeContext(
    service,
    org,
    candidates,
    context,
  );
  if (scoped.missing.length)
    return {
      ...base,
      type: "needs_clarification",
      access,
      missingContext: scoped.missing,
      explanation: `Supply applicability context: ${scoped.missing.join(", ")}. Opryn will not choose a scoped rule arbitrarily.`,
    };
  const knowledge = await trustedAnswerContext(
    service,
    org,
    scoped.knowledge,
    context,
  );
  if (scoped.knowledge.length && !knowledge.length) {
    const conflicts = await Promise.all(
      ["knowledge_chunk_a", "knowledge_chunk_b"].map((column) =>
        service
          .from("knowledge_conflicts")
          .select("id")
          .eq("organization_id", org)
          .eq("status", "open")
          .eq("conflict_type", "conflict")
          .in(
            column,
            scoped.knowledge.map((k) => k.id),
          )
          .limit(1),
      ),
    );
    if (conflicts.some((r) => r.error))
      throw conflicts.find((r) => r.error)!.error;
    const conflicting = conflicts.some((r) => r.data?.length);
    return {
      ...base,
      type: conflicting ? "conflict" : "needs_clarification",
      access,
      explanation: conflicting
        ? "The retrieved guidance has an unresolved source conflict."
        : "The retrieved guidance is blocked by the existing trust gate and requires review before use.",
    };
  }
  if (!knowledge.length)
    return {
      ...base,
      type: "unknown",
      access,
      explanation: scoped.outside
        ? "No authorized guidance applies to this context and effective date."
        : "No approved guidance was retrieved under this consumer's permissions.",
    };
  const metadata = await service
    .from("knowledge_chunks")
    .select("id,current_version,criticality,health_status")
    .eq("organization_id", org)
    .in(
      "id",
      knowledge.map((k) => k.id),
    );
  if (metadata.error) throw metadata.error;
  const baseThreshold =
    input.consumer === "employee" || input.consumer === "new_hire"
      ? (settings.data?.confidence_threshold ?? 0.72)
      : 0.72;
  const threshold = (metadata.data ?? []).some(
    (k) => k.criticality === "critical",
  )
    ? Math.max(baseThreshold, 0.9)
    : baseThreshold;
  const answer = await answerCompanyQuestion(
    input.question +
      "\n\nAPPLICABILITY CONTEXT (not policy authority):\n" +
      JSON.stringify(context),
    knowledge,
  );
  const cited = knowledge.filter((k) => answer.cited_source_ids.includes(k.id));
  if (
    !answer.can_answer ||
    answer.confidence < threshold ||
    !answer.answer.trim() ||
    !cited.length
  )
    return {
      ...base,
      type: "unknown",
      access,
      explanation:
        "The real answer service did not produce a sufficiently confident, source-backed answer.",
    };
  const current = await service
    .from("knowledge_chunks")
    .select("id,current_version")
    .eq("organization_id", org)
    .in(
      "id",
      cited.map((k) => k.id),
    );
  if (current.error) throw current.error;
  const authorizedNow = await verifyAccess();
  if (
    input.actorId &&
    (input.consumer === "employee" || input.consumer === "new_hire")
  ) {
    const freshContext = await memberScopeContext(
      service,
      org,
      input.actorId,
      "employee",
      input.context,
    );
    if (JSON.stringify(freshContext.roles) !== JSON.stringify(context.roles))
      return {
        ...base,
        type: "restricted",
        access,
        explanation:
          "The member's role changed during this run. Rerun under current access; no generated answer is returned.",
      };
  }
  if (cited.some((k) => !authorizedNow.includes(k.id)))
    return {
      ...base,
      type: "restricted",
      access,
      explanation:
        "Consumer access changed during this run. No generated answer is returned.",
    };
  if (
    cited.some(
      (k) =>
        current.data?.find((row) => row.id === k.id)?.current_version !==
        metadata.data?.find((row) => row.id === k.id)?.current_version,
    ) ||
    !(await trustedAnswerContext(service, org, cited, context)).length
  )
    return {
      ...base,
      type: "needs_clarification",
      access,
      explanation:
        "Knowledge changed during this run. Rerun against the current approved version.",
    };
  return {
    ...base,
    type: "answered",
    access,
    explanation:
      "Approved guidance retrieved under actual permissions and applicable scope. No external message was sent.",
    answer: [answer.answer, ...answer.steps, answer.important_note]
      .filter(Boolean)
      .join("\n\n"),
    sources: cited.map((k) => ({
      id: k.id,
      title: k.content.split(":")[0].slice(0, 120),
      source: k.source_type,
      version: metadata.data?.find((m) => m.id === k.id)?.current_version ?? 0,
      status: "Approved",
    })),
  };
}

export function compareTestExpectation(
  result: TestResult,
  expected: TestOutcome,
  knowledgeIds: string[],
) {
  return {
    passed:
      result.type === expected &&
      knowledgeIds.every((id) => result.sources.some((s) => s.id === id)),
    method: "Exact outcome and expected source IDs; no AI correctness judge.",
  };
}
