import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  freshnessReason,
  rankKnowledgeGaps,
  type GapCluster,
  type GapQuestion,
  type HealthKnowledge,
} from "./health-model";

const PAGE_SIZE = 500;
const MAX_ROWS = 5000;
/** Explicit bounded pagination: never silently mistake Supabase's row limit for a total. */
async function readRows<T>(
  service: SupabaseClient,
  table: string,
  columns: string,
  organizationId: string,
  since?: string,
) {
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    let query = service
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId);
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if ((data?.length ?? 0) < PAGE_SIZE) return { rows, limited: false };
  }
  return { rows, limited: true };
}

type Process = { id: string; title: string };
type Conflict = {
  id: string;
  knowledge_chunk_a: string;
  knowledge_chunk_b: string;
  explanation: string;
  status: string;
  conflict_type: string;
};
type Expert = {
  id: string;
  user_id: string;
  category: string | null;
  knowledge_chunk_id: string | null;
};
type Question = GapQuestion & { answered_by_opryn: boolean };

export async function getKnowledgeHealth(
  service: SupabaseClient,
  organizationId: string,
) {
  const now = Date.now();
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const [
    knowledge,
    processes,
    conflicts,
    experts,
    questions,
    clusters,
    settings,
    members,
  ] = await Promise.all([
    readRows<HealthKnowledge>(
      service,
      "knowledge_chunks",
      "id,content,process_id,source_type,approved,criticality,health_status,last_confirmed_at,source_modified_at,updated_at,created_at,usage_count,current_version",
      organizationId,
    ),
    readRows<Process>(service, "processes", "id,title", organizationId),
    readRows<Conflict>(
      service,
      "knowledge_conflicts",
      "id,knowledge_chunk_a,knowledge_chunk_b,explanation,status,conflict_type",
      organizationId,
    ),
    readRows<Expert>(
      service,
      "knowledge_experts",
      "id,user_id,category,knowledge_chunk_id",
      organizationId,
    ),
    readRows<Question>(
      service,
      "employee_questions",
      "id,cluster_id,status,escalated,asked_by,origin,created_at,answered_by_opryn",
      organizationId,
      since,
    ),
    readRows<GapCluster>(
      service,
      "question_clusters",
      "id,topic,representative_question,status",
      organizationId,
    ),
    service
      .from("organization_settings")
      .select("estimated_interruption_minutes")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    service
      .from("organization_members")
      .select("user_id,profiles!organization_members_user_id_fkey(full_name)")
      .eq("organization_id", organizationId),
  ]);
  if (settings.error || members.error) throw settings.error ?? members.error;
  const interruptionMinutes = Number(
    settings.data?.estimated_interruption_minutes ?? 3,
  );
  const processNames = new Map(
    processes.rows.map((row) => [row.id, row.title]),
  );
  const title = (item: HealthKnowledge) =>
    (item.process_id && processNames.get(item.process_id)) ||
    item.content.split(/[\n.!?]/)[0].slice(0, 120) ||
    "Company knowledge";
  const openConflicts = conflicts.rows.filter(
    (c) => c.status === "open" && c.conflict_type === "conflict",
  );
  const conflictIds = new Set(
    openConflicts.flatMap((c) => [c.knowledge_chunk_a, c.knowledge_chunk_b]),
  );
  const approved = knowledge.rows.filter((k) => k.approved);
  const freshness = approved
    .filter((k) => !conflictIds.has(k.id))
    .flatMap((k) => {
      const reason = freshnessReason(k, now);
      return reason ? [{ ...k, title: title(k), reason }] : [];
    })
    .sort(
      (a, b) =>
        Number(b.criticality === "critical") -
          Number(a.criticality === "critical") ||
        Date.parse(a.last_confirmed_at ?? a.created_at) -
          Date.parse(b.last_confirmed_at ?? b.created_at),
    );
  const freshIds = new Set(freshness.map((k) => k.id));
  const areas = new Map<
    string,
    {
      id: string;
      title: string;
      approved: number;
      conflicts: number;
      reviews: number;
      usage: number;
      href: string;
    }
  >();
  for (const item of approved) {
    const id = item.process_id || "company-guidance";
    const area = areas.get(id) ?? {
      id,
      title: item.process_id
        ? processNames.get(item.process_id) || "Company process"
        : "Company guidance",
      approved: 0,
      conflicts: 0,
      reviews: 0,
      usage: 0,
      href: item.process_id
        ? `/app/processes/${item.process_id}`
        : "/app/processes",
    };
    area.approved++;
    area.conflicts += Number(
      conflictIds.has(item.id) || item.health_status === "conflict",
    );
    area.reviews += Number(freshIds.has(item.id));
    area.usage += item.usage_count;
    areas.set(id, area);
  }
  const memberNames = new Map(
    (members.data ?? []).map((m) => {
      const raw = m.profiles as unknown as
        { full_name: string } | Array<{ full_name: string }> | null;
      const profile = Array.isArray(raw) ? raw[0] : raw;
      return [m.user_id, profile?.full_name || "Company expert"];
    }),
  );
  const expertAreas = new Map<string, { title: string; users: Set<string> }>();
  for (const expert of experts.rows) {
    if (!memberNames.has(expert.user_id)) continue; // A departed member is not an available expert.
    const item = knowledge.rows.find((k) => k.id === expert.knowledge_chunk_id);
    const label = expert.category?.trim() || (item ? title(item) : null);
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    const area = expertAreas.get(key) ?? {
      title: label,
      users: new Set<string>(),
    };
    area.users.add(expert.user_id);
    expertAreas.set(key, area);
  }
  const keyPersonRisks = [...expertAreas.values()]
    .filter((area) => area.users.size === 1)
    .map((area) => ({
      title: area.title,
      name: memberNames.get([...area.users][0])!,
    }));
  return {
    limited: [
      knowledge,
      processes,
      conflicts,
      experts,
      questions,
      clusters,
    ].some((result) => result.limited),
    approvedCount: approved.length,
    areas: [...areas.values()].sort(
      (a, b) =>
        b.conflicts - a.conflicts || b.reviews - a.reviews || b.usage - a.usage,
    ),
    freshness,
    conflicts: openConflicts,
    keyPersonRisks,
    gaps: rankKnowledgeGaps(
      clusters.rows,
      questions.rows,
      interruptionMinutes,
      now,
    ),
    mostUsed: approved
      .filter((k) => k.usage_count > 0)
      .sort((a, b) => b.usage_count - a.usage_count)
      .slice(0, 8)
      .map((k) => ({ ...k, title: title(k) })),
    recent: {
      asked: questions.rows.length,
      answered: questions.rows.filter((q) => q.answered_by_opryn).length,
      escalated: questions.rows.filter((q) => q.escalated).length,
    },
    interruptionMinutes,
  };
}

export async function getTeachNextGaps(
  service: SupabaseClient,
  organizationId: string,
) {
  const [clusters, questions, settings] = await Promise.all([
    readRows<GapCluster>(
      service,
      "question_clusters",
      "id,topic,representative_question,status",
      organizationId,
    ),
    readRows<GapQuestion>(
      service,
      "employee_questions",
      "id,cluster_id,status,escalated,asked_by,origin,created_at",
      organizationId,
      new Date(Date.now() - 30 * 86_400_000).toISOString(),
    ),
    service
      .from("organization_settings")
      .select("estimated_interruption_minutes")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);
  if (settings.error) throw settings.error;
  return rankKnowledgeGaps(
    clusters.rows,
    questions.rows,
    Number(settings.data?.estimated_interruption_minutes ?? 3),
  );
}
