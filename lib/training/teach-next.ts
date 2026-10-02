import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Bounded, exact question matching. Never infer an employee's ability from question frequency. */
export async function trainingTeachNext(db: SupabaseClient, org: string) {
  const [tests, feedback] = await Promise.all([
    db
      .from("knowledge_test_cases")
      .select(
        "id,title,question,connection_id,agent_response_required,last_agent_result,last_result",
      )
      .eq("organization_id", org)
      .is("retired_at", null)
      .not("connection_id", "is", null)
      .or(
        "last_result->>trainingStatus.eq.knowledge_gap,last_agent_result->>trainingStatus.eq.knowledge_gap",
      )
      .limit(101),
    db
      .from("knowledge_feedback")
      .select("knowledge_chunk_id,reason")
      .eq("organization_id", org)
      .is("question_id", null)
      .eq("status", "open")
      .limit(101),
  ]);
  if (tests.error || feedback.error) return null;
  const gaps = (tests.data ?? []).filter(
    (t) =>
      (t.agent_response_required ? t.last_agent_result : t.last_result)
        ?.trainingStatus === "knowledge_gap",
  );
  const candidates = new Map<
    string,
    { question: string; title: string; agents: Set<string> }
  >();
  for (const t of gaps.slice(0, 100)) {
    const key = t.question.trim().toLowerCase();
    const item = candidates.get(key) ?? {
      question: t.question,
      title: t.title,
      agents: new Set<string>(),
    };
    item.agents.add(t.connection_id);
    candidates.set(key, item);
  }
  if (candidates.size) {
    const questions = await db
      .from("employee_questions")
      .select("question,asked_by")
      .eq("organization_id", org)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .in(
        "question",
        [...candidates.values()].map((c) => c.question),
      )
      .limit(501);
    if (questions.error) return null;
    const ranked = [...candidates.values()]
      .map((c) => ({
        ...c,
        employees: new Set(
          (questions.data ?? [])
            .filter(
              (q) =>
                q.question.trim().toLowerCase() ===
                c.question.trim().toLowerCase(),
            )
            .map((q) => q.asked_by),
        ).size,
      }))
      .sort(
        (a, b) => b.agents.size + b.employees - (a.agents.size + a.employees),
      );
    const top = ranked[0];
    const limited =
      (tests.data?.length ?? 0) > 100 || (questions.data?.length ?? 0) > 500;
    return {
      title: top.title,
      question: top.question,
      reason: `${limited ? "At least " : ""}${top.agents.size} agents exposed this knowledge gap${top.employees ? `; ${top.employees} employees asked the same question in the last 30 days` : ""}. Review the missing guidance and permissions, then teach the approved answer.`,
      href: null,
    };
  }
  const counts = new Map<string, number>();
  for (const f of feedback.data ?? [])
    if (f.knowledge_chunk_id)
      counts.set(
        f.knowledge_chunk_id,
        (counts.get(f.knowledge_chunk_id) ?? 0) + 1,
      );
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  return {
    title: "Clarify guidance used in training",
    question: null,
    reason: `${(feedback.data?.length ?? 0) > 100 ? "At least " : ""}${top[1]} open training reports ask for review of this knowledge. Improve the approved guidance before assigning more practice.`,
    href: `/app/knowledge/${top[0]}/history`,
  };
}
