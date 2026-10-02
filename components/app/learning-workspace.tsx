"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionRegion } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import { learningState } from "@/lib/opryn/knowledge/learning-state";
type Process = {
  id: string;
  title: string;
  summary: string | null;
  updated_at: string;
  library_category: string;
};
type Progress = {
  process_id: string;
  learning_state: string;
  acknowledged_process_updated_at: string | null;
  practiced_process_updated_at: string | null;
};
export function MyLearning({
  processes,
  assignments,
}: {
  processes: Process[];
  assignments: Progress[];
}) {
  return (
    <div className="space-y-4">
      {processes.map((p) => (
        <LearningItem
          key={p.id}
          process={p}
          assignment={assignments.find((a) => a.process_id === p.id)!}
        />
      ))}
    </div>
  );
}
function LearningItem({
  process: p,
  assignment: a,
}: {
  process: Process;
  assignment: Progress;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{
    feedback: string;
    supportingQuote: string;
    result: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [localProgress, setLocalProgress] = useState({
    version: p.updated_at,
    state: learningState(a, p.updated_at),
  });
  const state =
    localProgress.version === p.updated_at
      ? localProgress.state
      : learningState(a, p.updated_at);
  async function act(action: "viewed" | "acknowledged" | "practiced") {
    if (busy) return;
    setBusy(action);
    setMessage("");
    setFeedback(null);
    try {
      const r = await fetch("/api/learning/activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processId: p.id,
          expectedUpdatedAt: p.updated_at,
          action,
          ...(action === "practiced" ? { response: answer } : {}),
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setLocalProgress({
        version: p.updated_at,
        state:
          action === "acknowledged"
            ? "Acknowledged"
            : action === "practiced"
              ? "Practiced"
              : state === "Not started"
                ? "Viewed"
                : state,
      });
      setFeedback(b.feedback ?? null);
      setMessage(
        action === "practiced"
          ? "Practice recorded—not a proficiency certification."
          : action === "acknowledged"
            ? "You acknowledged this version."
            : "Reading progress saved.",
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Learning could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <MotionRegion
      variant="quiet"
      className="rounded-3xl border border-[#dbe5f2] bg-white p-5 sm:p-7"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2855F9]">
        {state}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#566279]">{p.summary}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/app/processes/${p.id}`}
          className="opryn-action"
          onClick={() => void act("viewed")}
        >
          Read guidance
        </Link>
        <button
          disabled={!!busy || state === "Acknowledged"}
          className="opryn-secondary-action"
          onClick={() => void act("acknowledged")}
        >
          {busy === "acknowledged" ? "Saving…" : "Acknowledge this version"}
        </button>
      </div>
      <details className="mt-5">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          Practice applying this guidance
        </summary>
        <p className="my-3 text-sm text-[#566279]">
          In your own words, how would you apply “{p.title}”? Include any limits
          or approval requirements. Feedback uses only approved guidance
          available to you.
        </p>
        <label className="block text-sm font-semibold">
          Your response
          <textarea
            className="opryn-input mt-2 w-full"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={3000}
          />
        </label>
        <button
          disabled={!!busy || answer.trim().length < 10}
          className="opryn-action mt-3"
          onClick={() => void act("practiced")}
        >
          {busy === "practiced" ? (
            <>
              <OprynThinkingOrb
                size={20}
                state="solving"
                label="Checking approved guidance"
                decorative
              />
              Comparing with approved guidance…
            </>
          ) : (
            "Compare with guidance"
          )}
        </button>
        {feedback && (
          <div className="mt-4 rounded-2xl bg-[#EAF4FF] p-4">
            <p className="text-sm leading-6">{feedback.feedback}</p>
            {feedback.supportingQuote && (
              <blockquote className="mt-3 border-l-2 border-[#2855F9] pl-3 text-sm">
                {feedback.supportingQuote}
              </blockquote>
            )}
            <Link
              className="mt-3 inline-block text-sm font-semibold text-[#2855F9]"
              href={`/app/processes/${p.id}`}
            >
              Source: {p.title}
            </Link>
          </div>
        )}
      </details>
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-sm text-[#566279]"
      >
        {message}
      </p>
    </MotionRegion>
  );
}
export function RoleLearningAssignment({
  roles,
  processes,
  requirements = [],
}: {
  roles: Array<{ id: string; name: string }>;
  processes: Process[];
  requirements?: Array<{ role_id: string; process_id: string }>;
}) {
  const router = useRouter();
  const [role, setRole] = useState(roles[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function assign() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/learning/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: role, processIds: selected }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage(
        `Assigned ${b.processes} approved processes to this role. Current and future role members receive them.`,
      );
      setSelected([]);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(processId: string) {
    if (
      busy ||
      !window.confirm(
        "Remove this role requirement? Role-origin learning assignments will be removed. Independent assignments and company knowledge stay.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/learning/roles", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleId: role, processId }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setMessage("Role requirement removed. Company knowledge is unchanged.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Requirement could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mb-7 rounded-3xl border border-[#cfdff2] bg-[#EAF4FF] p-5 sm:p-7">
      <h2 className="text-xl font-semibold">Start here for your role</h2>
      <p className="mt-2 text-sm text-[#566279]">
        Assign approved guidance to a role. Individual assignments below remain
        available. No scores or employee rankings.
      </p>
      <fieldset disabled={busy} className="mt-4">
        <legend className="sr-only">Role learning assignment</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Role
            <select
              className="opryn-input mt-2 w-full"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Knowledge area
            <select
              className="opryn-input mt-2 w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All areas</option>
              {[...new Set(processes.map((p) => p.library_category))].map(
                (c) => (
                  <option key={c} value={c}>
                    {c.replaceAll("_", " ")}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div className="mt-4 max-h-64 overflow-y-auto">
          {processes
            .filter((p) => !category || p.library_category === category)
            .map((p) => (
              <label
                key={p.id}
                className="flex min-h-12 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(p.id)
                        ? s.filter((id) => id !== p.id)
                        : [...s, p.id],
                    )
                  }
                />
                {p.title}
              </label>
            ))}
        </div>
        <button
          className="opryn-action mt-4"
          disabled={!role || !selected.length}
          onClick={() => void assign()}
        >
          {busy ? "Assigning…" : "Assign role guidance"}
        </button>
      </fieldset>
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          Current role requirements
        </summary>
        {requirements
          .filter((r) => r.role_id === role)
          .map((r) => (
            <div
              key={r.process_id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
            >
              <span>
                {processes.find((p) => p.id === r.process_id)?.title ??
                  "Retired process"}
              </span>
              <button
                disabled={busy}
                className="min-h-11 rounded-xl border border-[#cdddf3] px-3"
                onClick={() => void remove(r.process_id)}
              >
                Remove requirement
              </button>
            </div>
          ))}
      </details>
      <p role="status" className="mt-3 text-sm text-[#566279]">
        {message}
      </p>
    </section>
  );
}
