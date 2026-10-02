export type TrainingKnowledge = {
  id: string;
  content: string;
  current_version: number;
  source_type: string;
  process_id: string | null;
  library_category: string;
  approved: boolean;
  health_status: string;
  library_archived_at: string | null;
  scope: unknown;
  role_id: string | null;
};
export type KnowledgeAssignment = {
  id: string;
  user_id: string;
  knowledge_chunk_id: string;
  required_version: number;
  acknowledged_version: number | null;
  passed_version: number | null;
  update_required: boolean;
  previous_version: number | null;
  started_at: string | null;
  retired_at: string | null;
};
export type TrainingScenario = {
  id: string;
  knowledge_chunk_id: string;
  knowledge_version: number;
  format: string;
  prompt: string;
  supporting_quote: string;
  status: string;
  revision: number;
};
export type Readiness =
  | "Not Started"
  | "Learning"
  | "Practice Needed"
  | "Ready"
  | "Update Required"
  | "Blocked";
export function knowledgeReadiness(
  a: KnowledgeAssignment,
  k: TrainingKnowledge | undefined,
  scenario?: TrainingScenario,
  accessible = true,
): Readiness {
  if (
    !k ||
    !accessible ||
    !k.approved ||
    k.library_archived_at ||
    k.health_status !== "healthy"
  )
    return "Blocked";
  if (a.update_required || a.required_version !== k.current_version)
    return "Update Required";
  if (a.acknowledged_version !== k.current_version)
    return a.started_at ? "Learning" : "Not Started";
  if (
    !scenario ||
    scenario.status !== "approved" ||
    scenario.knowledge_version !== k.current_version
  )
    return "Blocked";
  if (
    scenario.format !== "acknowledgement" &&
    a.passed_version !== k.current_version
  )
    return "Practice Needed";
  return "Ready";
}
export function agentReadiness(
  active: boolean,
  tests: Array<{
    needs_rerun: boolean;
    agent_response_required?: boolean;
    agent_response_needs_update?: boolean;
    last_agent_result?: { trainingStatus?: string } | null;
    last_result?: {
      trainingStatus?: string;
      comparison?: { passed: boolean };
    } | null;
  }>,
) {
  if (!active) return "Blocked";
  if (!tests.length) return "Not Tested";
  if (tests.some((t) => t.needs_rerun || t.agent_response_needs_update))
    return "Update Required";
  if (
    tests.some(
      (t) =>
        (t.agent_response_required ? t.last_agent_result : t.last_result)
          ?.trainingStatus !== "passed",
    )
  )
    return "Needs Attention";
  return "Ready";
}
export function classifyEvaluation(
  type: string,
  passed: boolean,
  behaviorReviewed = false,
) {
  if (type === "unknown") return "knowledge_gap" as const;
  if (
    type === "restricted" ||
    type === "conflict" ||
    type === "needs_clarification"
  )
    return "review" as const;
  if (!passed) return "failed" as const;
  return behaviorReviewed ? ("passed" as const) : ("review" as const);
}
export function knowledgeTitle(k: { content: string }) {
  return k.content.split(/[\n:]/)[0].slice(0, 100);
}
