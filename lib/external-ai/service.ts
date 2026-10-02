import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { trustedAnswerContext } from "@/lib/opryn/knowledge/trust";
import type { ScopeContext } from "@/lib/opryn/knowledge/scope";
import {
  answerCompanyQuestion,
  embedKnowledge,
  type RetrievedKnowledge,
} from "@/lib/ai/services";

export async function searchExternalKnowledge(
  service: SupabaseClient,
  connectionId: string,
  organizationId: string,
  query: string,
  limit = 12,
  scopes: Set<string> = new Set(["processes:read", "policies:read"]),
  scopeContext: ScopeContext = {},
) {
  const result = await searchExternalKnowledgeWithEmbedding(
    service,
    connectionId,
    organizationId,
    query,
    limit,
    scopes,
    scopeContext,
  );
  return result.knowledge;
}

export async function searchExternalKnowledgeWithEmbedding(
  service: SupabaseClient,
  connectionId: string,
  organizationId: string,
  query: string,
  limit = 12,
  scopes: Set<string> = new Set(["processes:read", "policies:read"]),
  scopeContext: ScopeContext = {},
) {
  const sourceTypes = [
    "role_instruction",
    "call_finding",
    "faq",
    "google_drive",
    "video_finding",
  ];
  if (scopes.has("processes:read"))
    sourceTypes.push("process_summary", "process_step", "exception");
  if (scopes.has("policies:read")) sourceTypes.push("rule", "owner_answer");
  const [embedding] = await embedKnowledge([query]);
  const { data, error } = await service.rpc("match_external_ai_knowledge", {
    target_connection_id: connectionId,
    target_organization_id: organizationId,
    query_embedding: embedding,
    target_source_types: sourceTypes,
    match_threshold: 0.3,
    match_count: Math.min(Math.max(limit, 1), 20),
  });
  if (error) throw error;
  const raw = (data ?? []) as RetrievedKnowledge[];
  const versions = raw.length
    ? await service
        .from("knowledge_chunks")
        .select("id,current_version,content")
        .eq("organization_id", organizationId)
        .in(
          "id",
          raw.map((k) => k.id),
        )
    : { data: [], error: null };
  if (versions.error) throw versions.error;
  const stable = raw.filter((k) =>
    versions.data?.some((v) => v.id === k.id && v.content === k.content),
  );
  return {
    knowledge: await trustedAnswerContext(service, organizationId, stable, {
      ...scopeContext,
      channels: ["external_ai"],
    }),
    embedding,
    versions: (versions.data ?? [])
      .filter((v) => stable.some((k) => k.id === v.id))
      .map((v) => ({ id: v.id, version: v.current_version })),
  };
}

export async function answerExternalQuestion(
  question: string,
  context: string | undefined,
  knowledge: RetrievedKnowledge[],
) {
  return answerCompanyQuestion(
    context?.trim()
      ? `${question}\n\nSITUATIONAL CONTEXT:\n${context.trim()}`
      : question,
    knowledge,
  );
}

export async function logExternalActivity(
  service: SupabaseClient,
  input: {
    organizationId: string;
    connectionId: string;
    endpoint: "answer" | "knowledge_search" | "escalations";
    resultStatus: "answered" | "unknown" | "created" | "error" | "rate_limited";
    startedAt: number;
    sourceCount?: number;
    knowledgeVersions?: Array<{ id: string; version: number }>;
  },
) {
  await service.from("external_ai_activity").insert({
    organization_id: input.organizationId,
    connection_id: input.connectionId,
    endpoint: input.endpoint,
    result_status: input.resultStatus,
    latency_ms: Math.max(0, Date.now() - input.startedAt),
    source_count: input.sourceCount ?? 0,
    knowledge_versions: input.knowledgeVersions ?? [],
  });
}

export function sourceTitle(source: RetrievedKnowledge) {
  const labels: Record<string, string> = {
    process_summary: "Process overview",
    process_step: "Process step",
    rule: "Company rule",
    exception: "Process exception",
    owner_answer: "Approved owner answer",
    role_instruction: "Training knowledge",
    call_finding: "Approved call knowledge",
    faq: "Approved FAQ",
    google_drive: "Approved Google Drive knowledge",
    video_finding: "Approved video knowledge",
  };
  return {
    id: source.source_id,
    title: source.content.split(":")[0].slice(0, 120),
    section: labels[source.source_type] ?? "Company knowledge",
  };
}
