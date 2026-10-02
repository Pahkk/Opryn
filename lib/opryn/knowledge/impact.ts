import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasFeature } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { z } from "zod";
import { externalPolicyAllows } from "@/lib/external-ai/policy";

export type ImpactKnowledge = {
  id: string;
  content: string;
  approved: boolean;
  current_version: number;
  process_id: string | null;
  rule_id: string | null;
  role_id: string | null;
  source_id: string | null;
  source_type: string;
  library_archived_at: string | null;
  health_status: string;
  scope: unknown;
  library_category?: string;
};
type Access = {
  connection_id: string;
  source_type: string;
  source_id: string | null;
};
export function connectionPermitsKnowledge(
  item: ImpactKnowledge,
  mode: string,
  scopes: string[],
  access: Access[],
  policy?: unknown,
) {
  if (
    !item.approved ||
    item.library_archived_at ||
    !scopes.includes("knowledge:read")
  )
    return false;
  const types = [
    "role_instruction",
    "call_finding",
    "faq",
    "google_drive",
    "video_finding",
  ];
  if (scopes.includes("policies:read")) types.push("rule", "owner_answer");
  if (scopes.includes("processes:read"))
    types.push("process_summary", "process_step", "exception");
  return (
    externalPolicyAllows(policy, item) &&
    types.includes(item.source_type) &&
    (mode === "all_approved" ||
      access.some(
        (rule) =>
          rule.source_type === item.source_type &&
          (rule.source_id === null ||
            [
              item.source_id,
              item.process_id,
              item.rule_id,
              item.role_id,
            ].includes(rule.source_id)),
      ))
  );
}

/** Caller must be owner/admin. All datasets explicitly stay in the active organization. */
export async function getKnowledgeImpact(
  db: SupabaseClient,
  org: string,
  id: string,
) {
  const knowledge = await db
    .from("knowledge_chunks")
    .select(
      "id,content,approved,current_version,process_id,rule_id,role_id,source_id,source_type,library_archived_at,health_status,scope,library_category",
    )
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (knowledge.error) throw knowledge.error;
  if (!knowledge.data) return null;
  const item = knowledge.data as ImpactKnowledge;
  const originProcess = item.process_id
    ? await db
        .from("processes")
        .select("title,source_title,source_url,supersedes_process_id")
        .eq("organization_id", org)
        .eq("id", item.process_id)
        .maybeSingle()
    : { data: null, error: null };
  if (originProcess.error) throw originProcess.error;
  const predecessorKnowledge = originProcess.data?.supersedes_process_id
    ? await db
        .from("knowledge_chunks")
        .select("id")
        .eq("organization_id", org)
        .eq("process_id", originProcess.data.supersedes_process_id)
        .limit(101)
    : { data: [], error: null };
  if (predecessorKnowledge.error) throw predecessorKnowledge.error;
  const decisions = await db
    .from("knowledge_events")
    .select("metadata")
    .eq("organization_id", org)
    .eq("event_type", "needs_you_resolved")
    .contains("metadata", { replacement_knowledge_id: id })
    .limit(5);
  if (decisions.error) throw decisions.error;
  const replacedIds = [
    ...new Set([
      ...(predecessorKnowledge.data ?? []).slice(0, 100).map((row) => row.id),
      ...(decisions.data ?? []).flatMap((row) => {
        const result = z
          .array(z.uuid())
          .max(20)
          .safeParse(row.metadata?.previous_knowledge_ids);
        return result.success ? result.data : [];
      }),
    ]),
  ];
  const impactIds = [id, ...replacedIds];
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [
    related,
    tests,
    citations,
    connections,
    scopes,
    access,
    source,
    process,
    plan,
  ] = await Promise.all([
    item.process_id || replacedIds.length
      ? db
          .from("knowledge_chunks")
          .select("id,content,approved,current_version")
          .eq("organization_id", org)
          .or(
            [
              ...(item.process_id ? [`process_id.eq.${item.process_id}`] : []),
              ...(replacedIds.length
                ? [`id.in.(${replacedIds.join(",")})`]
                : []),
            ].join(","),
          )
          .neq("id", id)
          .limit(101)
      : { data: [], error: null },
    db
      .from("knowledge_test_cases")
      .select("id,title,expected_outcome,last_run_at")
      .eq("organization_id", org)
      .or(
        impactIds
          .flatMap((key) => [
            `linked_knowledge_ids.cs.{${key}}`,
            `expected_knowledge_ids.cs.{${key}}`,
          ])
          .join(","),
      )
      .limit(101),
    db
      .from("question_sources")
      .select("question_id,created_at")
      .eq("organization_id", org)
      .in("knowledge_chunk_id", impactIds)
      .gte("created_at", since)
      .limit(501),
    db
      .from("external_ai_connections")
      .select("id,name,status,knowledge_mode,knowledge_policy")
      .eq("organization_id", org)
      .eq("status", "active")
      .limit(201),
    db
      .from("external_ai_scopes")
      .select("connection_id,scope")
      .eq("organization_id", org)
      .limit(501),
    db
      .from("external_ai_knowledge_access")
      .select("connection_id,source_type,source_id")
      .eq("organization_id", org)
      .limit(501),
    item.process_id
      ? db
          .from("integration_sources")
          .select(
            "id,title,provider,process_id,approved_process_id,sync_status,review_status,modified_at,provider_version,last_checked_at,last_imported_at,normalized_content,previous_content,integration_id,integrations(status)",
          )
          .eq("organization_id", org)
          .or(
            `process_id.eq.${item.process_id},approved_process_id.eq.${item.process_id}`,
          )
          .limit(2)
      : { data: [], error: null },
    Promise.resolve(originProcess),
    getOrganizationPlan(db, org),
  ]);
  for (const result of [
    related,
    tests,
    citations,
    connections,
    scopes,
    access,
    source,
    process,
  ])
    if (result.error) throw result.error;
  const limited =
    (predecessorKnowledge.data?.length ?? 0) > 100 ||
    (related.data?.length ?? 0) > 100 ||
    (tests.data?.length ?? 0) > 100 ||
    (citations.data?.length ?? 0) > 500 ||
    (connections.data?.length ?? 0) > 200 ||
    (scopes.data?.length ?? 0) > 500 ||
    (access.data?.length ?? 0) > 500;
  const permitted = hasFeature(plan.plan, "aiConnections")
    ? (connections.data ?? []).filter((connection) =>
        connectionPermitsKnowledge(
          item,
          connection.knowledge_mode,
          (scopes.data ?? [])
            .filter((s) => s.connection_id === connection.id)
            .map((s) => s.scope),
          (access.data ?? []).filter((a) => a.connection_id === connection.id),
          connection.knowledge_policy,
        ),
      )
    : [];
  const [employees, roles, scenarios] = await Promise.all([
    db
      .from("training_assignments")
      .select("user_id", { count: "exact" })
      .eq("organization_id", org)
      .in("knowledge_chunk_id", impactIds)
      .is("retired_at", null)
      .limit(501),
    db
      .from("role_knowledge_requirements")
      .select("role_id")
      .eq("organization_id", org)
      .in("knowledge_chunk_id", impactIds)
      .limit(201),
    db
      .from("training_scenarios")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .in("knowledge_chunk_id", impactIds)
      .neq("status", "retired"),
  ]);
  for (const result of [employees, roles, scenarios])
    if (result.error) throw result.error;
  return {
    employees: new Set(
      (employees.data ?? []).slice(0, 500).map((a) => a.user_id),
    ).size,
    roles: new Set((roles.data ?? []).slice(0, 200).map((a) => a.role_id)).size,
    scenarios: scenarios.count ?? 0,
    item,
    title: process.data?.title ?? item.content.split(/[.\n:]/)[0].slice(0, 120),
    sourceTitle: process.data?.source_title ?? item.source_type,
    sourceUrl: process.data?.source_url ?? null,
    predecessor: process.data?.supersedes_process_id ?? null,
    related: (related.data ?? []).slice(0, 100),
    tests: (tests.data ?? []).slice(0, 100),
    questionCount: new Set(
      (citations.data ?? []).slice(0, 500).map((s) => s.question_id),
    ).size,
    permitted: permitted.slice(0, 200).map((c) => ({ id: c.id, name: c.name })),
    source: source.data?.[0] ?? null,
    replacedIds,
    limited:
      limited ||
      (employees.data?.length ?? 0) > 500 ||
      (roles.data?.length ?? 0) > 200,
  };
}
export type KnowledgeImpact = NonNullable<
  Awaited<ReturnType<typeof getKnowledgeImpact>>
>;
