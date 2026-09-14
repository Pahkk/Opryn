/** Transparent review rules, not an AI-generated health score. */
export const FRESHNESS_DAYS = { critical: 90, normal: 180 } as const;
const DAY = 86_400_000;

export type HealthKnowledge = {
  id: string;
  content: string;
  process_id: string | null;
  source_type: string;
  approved: boolean;
  criticality: string;
  health_status: string;
  last_confirmed_at: string | null;
  source_modified_at: string | null;
  updated_at: string;
  created_at: string;
  usage_count: number;
  current_version: number;
};

export function freshnessReason(
  item: Pick<
    HealthKnowledge,
    | "approved"
    | "criticality"
    | "health_status"
    | "last_confirmed_at"
    | "source_modified_at"
    | "created_at"
  >,
  now = Date.now(),
): string | null {
  if (!item.approved || item.health_status === "conflict") return null;
  if (item.health_status === "needs_review") return "Marked for review";
  const confirmed = Date.parse(item.last_confirmed_at ?? item.created_at);
  if (!Number.isFinite(confirmed)) return "Confirmation date unavailable";
  if (
    item.source_modified_at &&
    Date.parse(item.source_modified_at) > confirmed
  )
    return "Source changed since the last confirmation";
  const days =
    item.criticality === "critical"
      ? FRESHNESS_DAYS.critical
      : FRESHNESS_DAYS.normal;
  if (now - confirmed >= days * DAY)
    return item.last_confirmed_at
      ? `Not confirmed in ${days} days`
      : `No confirmation recorded in ${days} days`;
  return null;
}

export type GapQuestion = {
  id: string;
  cluster_id: string | null;
  status: string;
  escalated: boolean;
  asked_by: string | null;
  origin: string;
  created_at: string;
};
export type GapCluster = {
  id: string;
  topic: string;
  representative_question: string;
  status: string;
};

export function rankKnowledgeGaps(
  clusters: GapCluster[],
  questions: GapQuestion[],
  interruptionMinutes: number,
  now = Date.now(),
) {
  const recent = questions.filter(
    (q) => Date.parse(q.created_at) >= now - 30 * DAY,
  );
  const byCluster = new Map<string, GapQuestion[]>();
  for (const question of recent) {
    if (!question.cluster_id) continue;
    const group = byCluster.get(question.cluster_id) ?? [];
    group.push(question);
    byCluster.set(question.cluster_id, group);
  }
  return clusters
    .filter((c) => c.status === "open")
    .flatMap((cluster) => {
      const grouped = byCluster.get(cluster.id) ?? [];
      const unresolved = grouped.filter((q) => q.status === "needs_owner");
      if (!unresolved.length) return [];
      const escalations = grouped.filter((q) => q.escalated).length;
      const people = new Set(grouped.map((q) => q.asked_by).filter(Boolean))
        .size;
      const channels: Record<string, number> = {};
      for (const question of grouped)
        channels[question.origin] = (channels[question.origin] ?? 0) + 1;
      const lastAsked = Math.max(
        ...grouped.map((q) => Date.parse(q.created_at)),
      );
      // Internal ordering only; never presented as a business/AI score.
      const priority =
        unresolved.length * 4 +
        escalations * 3 +
        people +
        (now - lastAsked < 7 * DAY ? 2 : 0);
      return [
        {
          ...cluster,
          questions: grouped.length,
          unresolved: unresolved.length,
          escalations,
          people,
          channels,
          lastAsked,
          priority,
          estimatedMinutes: Math.round(escalations * interruptionMinutes),
          questionId:
            unresolved.find((q) => q.escalated)?.id ?? unresolved[0].id,
        },
      ];
    })
    .sort((a, b) => b.priority - a.priority || b.lastAsked - a.lastAsked);
}

export function answeringMustWait(
  rows: Array<{ approved: boolean; health_status: string }>,
  expectedCount: number,
) {
  // Revalidate after retrieval. Missing/withdrawn knowledge also fails closed.
  return (
    rows.length !== expectedCount ||
    rows.some(
      (row) =>
        !row.approved ||
        row.health_status === "conflict" ||
        row.health_status === "needs_review",
    )
  );
}
