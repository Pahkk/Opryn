"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
export function ApprovalImpact({
  processId,
  knowledgeId,
}: {
  processId?: string;
  knowledgeId?: string;
}) {
  const [impact, setImpact] = useState<{
      people: number;
      roles: number;
      agents: number;
      tests: number;
      scenarios: number;
      limited: boolean;
    } | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(
      `/api/training/impact?${knowledgeId ? `knowledgeId=${knowledgeId}` : `processId=${processId}`}`,
      { signal: abort.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setImpact)
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [processId, knowledgeId]);
  return (
    <aside className="my-5 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <h3 className="text-sm font-semibold">Training impact before approval</h3>
      <p className="mt-2 text-sm text-slate-600">
        {error
          ? "Impact is unavailable. Review the training map before approving a critical change."
          : impact
            ? `${impact.limited ? "At least " : ""}${impact.people} employees · ${impact.roles} roles · ${impact.agents} agents with saved tests · ${impact.scenarios} scenarios · ${impact.tests} saved tests`
            : "Checking linked training…"}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Material changes require updated employee guidance and agent evaluation
        reruns. New role assignments remain your choice.
      </p>
      <Link
        href="/app/training"
        className="mt-2 inline-block text-sm text-blue-600"
      >
        View training →
      </Link>
    </aside>
  );
}
