"use client";
import { OprynAction } from "@/components/motion/opryn-action";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MotionRegion, StaggerList } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import type {
  TestConsumer,
  TestResult,
  TestOutcome,
} from "@/lib/opryn/knowledge/testbench";
import { scopeDimensions } from "@/lib/opryn/knowledge/scope";
const consumers: Record<TestConsumer, string> = {
  employee: "Employee",
  new_hire: "New hire",
  connected_ai: "Connected AI",
  support_bot: "Support bot",
  call_agent: "Call agent",
};
type SavedTest = {
  id: string;
  title: string;
  question: string;
  expected_outcome: TestOutcome;
  needsRerun: boolean;
  last_result: (TestResult & { comparison: { passed: boolean } }) | null;
};
export function KnowledgeTestbench({
  people,
  connections,
  knowledge,
  defaultActorId,
  initialKnowledgeId,
  initialConnectionId,
  initialTestId,
}: {
  people: Array<{ id: string; name: string }>;
  connections: Array<{ id: string; name: string; status: string }>;
  knowledge: Array<{ id: string; title: string; version: number }>;
  defaultActorId: string;
  initialKnowledgeId?: string;
  initialConnectionId?: string;
  initialTestId?: string;
}) {
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [consumer, setConsumer] = useState<TestConsumer>(
      connections.some((c) => c.id === initialConnectionId)
        ? "connected_ai"
        : "employee",
    ),
    [actorId, setActorId] = useState(defaultActorId),
    [connectionId, setConnectionId] = useState(
      connections.find((c) => c.id === initialConnectionId)?.id ??
        connections[0]?.id ??
        "",
    ),
    [question, setQuestion] = useState(""),
    [title, setTitle] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [expectedOutcome, setExpectedOutcome] = useState<TestOutcome>("answered"),
    [expectedIds, setExpectedIds] = useState<string[]>(
      knowledge.some((k) => k.id === initialKnowledgeId)
        ? [initialKnowledgeId!]
        : [],
    ),
    [result, setResult] = useState<TestResult | null>(null),
    [comparison, setComparison] = useState<{ passed: boolean } | null>(null),
    [tests, setTests] = useState<SavedTest[]>([]),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const request = useRef<AbortController | null>(null);
  const [completedRun, setCompletedRun] = useState("");
  const runFingerprint = JSON.stringify({
    question,
    consumer,
    actorId,
    connectionId,
    fields,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/knowledge-tests${initialTestId ? `?testId=${encodeURIComponent(initialTestId)}` : ""}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Saved tests could not load.");
        if (!controller.signal.aborted) setTests(data.tests);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [initialTestId]);
  async function action(
    action: "run" | "save" | "rerun" | "delete",
    id?: string,
  ) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(action === "delete" ? "delete" : action);
    setError("");
    setReceipt("");
    try {
      const context = Object.fromEntries(
        scopeDimensions
          .filter((d) => fields[d]?.trim())
          .map((d) => [
            d,
            fields[d]
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ]),
      );
      const team = consumer === "employee" || consumer === "new_hire";
      const r = await fetch("/api/knowledge-tests", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          title: title || undefined,
          question: question || undefined,
          context,
          consumer,
          actorId: team ? actorId : undefined,
          connectionId: team ? undefined : connectionId,
          expectedOutcome,
          expectedBehavior,
          expectedKnowledgeIds: expectedIds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Test could not finish.");
      if (controller.signal.aborted) return;
      if (data.result) {
        setResult(data.result);
        setComparison(data.comparison);
        setCompletedRun(runFingerprint);
      }
      if (action === "save")
        setReceipt(
          data.queued
            ? "Test saved. Evaluation queued in Training → Agents."
            : "Test saved with its actual run result.",
        );
      if (action === "rerun" && data.queued)
        setReceipt("Evaluation queued in Training → Agents.");
      if (action === "delete")
        setReceipt("Saved test retired. Evaluation history is preserved.");
      if (action !== "run") {
        const list = await fetch("/api/knowledge-tests", {
          signal: controller.signal,
        });
        const next = await list.json();
        if (!list.ok)
          throw Error("Saved test changed, but the list could not refresh.");
        if (!controller.signal.aborted) setTests(next.tests);
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy("");
    }
  }
  const team = consumer === "employee" || consumer === "new_hire";
  const canRun =
    question.trim().length >= 3 && (team ? !!actorId : !!connectionId) && !busy;
  const inputClass =
    "mt-2 min-h-11 w-full rounded-xl border border-[#dfe6f0] bg-white px-3 py-2";
  return (
    <div className="max-w-5xl space-y-7" data-guide="knowledge.testbench">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action("run");
        }}
        className="rounded-3xl border border-[#dfe6f0] bg-white p-5 sm:p-7"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[#2855f9]">
          Opryn response simulation
        </p>
        <p className="mt-2 text-sm text-[#566279]">
          No external messages, calls, approvals or knowledge gaps are created.
          Member/connection permissions are real; perspective labels do not
          grant access.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Perspective
            <select
              className={inputClass}
              value={consumer}
              disabled={!!busy}
              onChange={(e) => setConsumer(e.target.value as TestConsumer)}
            >
              {Object.entries(consumers).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {team ? (
            <label className="text-sm">
              Actual member access
              <select
                className={inputClass}
                value={actorId}
                disabled={!!busy}
                onChange={(e) => setActorId(e.target.value)}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm">
              Actual connection access
              <select
                className={inputClass}
                value={connectionId}
                disabled={!!busy}
                onChange={(e) => setConnectionId(e.target.value)}
              >
                <option value="">Choose a connection</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.status}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="mt-5 block font-semibold">
          Ask a question
          <textarea
            className={`${inputClass} min-h-28 font-normal`}
            value={question}
            maxLength={4000}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Can a manager approve a $700 refund?"
          />
        </label>
        <label className="mt-5 block font-semibold">
          Expected behavior
          <textarea
            className={`${inputClass} min-h-20 font-normal`}
            value={expectedBehavior}
            onChange={(e) => setExpectedBehavior(e.target.value)}
            maxLength={2000}
            placeholder="Explain the required manager approval, without inventing an exception."
          />
        </label>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Optional applicability context
          </summary>
          <p className="mt-2 text-xs text-[#566279]">
            Member roles and the channel are derived from actual access.
            External role context describes applicability only; it never grants
            connection access.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {scopeDimensions
              .filter((d) => d !== "channels" && (!team || d !== "roles"))
              .map((d) => (
                <label key={d} className="text-sm">
                  {d.replace(/([A-Z])/g, " $1")}
                  <input
                    className={inputClass}
                    value={fields[d] ?? ""}
                    onChange={(e) =>
                      setFields((p) => ({ ...p, [d]: e.target.value }))
                    }
                    maxLength={2400}
                  />
                </label>
              ))}
          </div>
        </details>
        <div className="mt-5">
          <OprynAction
            type="submit"
            label="Test answer"
            pendingLabel="Testing…"
            successLabel="Test finished"
            state={
              busy === "run"
                ? "pending"
                : result && completedRun === runFingerprint
                  ? "success"
                  : "idle"
            }
            repeatable
            disabled={!canRun}
          />
        </div>
        {busy && busy !== "delete" ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 flex items-center gap-3"
          >
            <OprynThinkingOrb
              state="solving"
              label="Testing approved guidance"
              decorative
            />
            <span>Testing permissions, scope and approved guidance…</span>
          </div>
        ) : null}
        <details className="mt-5 border-t border-[#dfe6f0] pt-4">
          <summary className="cursor-pointer font-semibold">
            Save an expected outcome
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Test title
              <input
                className={inputClass}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="$700 refund"
              />
            </label>
            <label className="text-sm">
              Expected result
              <select
                className={inputClass}
                value={expectedOutcome}
                onChange={(e) =>
                  setExpectedOutcome(e.target.value as TestOutcome)
                }
              >
                {[
                  "answered",
                  "unknown",
                  "conflict",
                  "needs_clarification",
                  "restricted",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block text-sm">
            Expected approved source (optional)
            <select
              className={inputClass}
              value={expectedIds[0] ?? ""}
              onChange={(e) =>
                setExpectedIds(e.target.value ? [e.target.value] : [])
              }
            >
              <option value="">No specific source expectation</option>
              {knowledge.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title} · v{k.version}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-[#566279]">
            Pass means the exact result type and selected source match—not an AI
            judgment of correctness. Saving runs the test again.
          </p>
          <div className="mt-3">
            <OprynAction
              variant="secondary"
              label="Save and run test"
              pendingLabel="Saving test…"
              successLabel="Saved"
              state={
                busy === "save"
                  ? "pending"
                  : receipt === "Test saved with its actual run result."
                    ? "success"
                    : "idle"
              }
              repeatable
              disabled={!canRun || !title.trim()}
              onClick={() => void action("save")}
            />
          </div>
        </details>
      </form>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {receipt ? (
        <p role="status" className="text-sm">
          {receipt}
        </p>
      ) : null}
      {result ? (
        <MotionRegion variant="status" changeKey={result.testedAt}>
          <section
            className="rounded-3xl bg-[#eaf4ff] p-5 sm:p-7"
            aria-label="Test result"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">
                {result.type.replaceAll("_", " ")}
              </h2>
              {comparison ? (
                <span className="rounded-full bg-white px-3 py-1 text-sm">
                  {comparison.passed
                    ? "Matches expectation"
                    : "Does not match expectation"}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm font-semibold">
              Tested question: {result.question}
            </p>
            {result.answer ? (
              <p className="mt-4 whitespace-pre-wrap leading-7">
                {result.answer}
              </p>
            ) : null}
            <p className="mt-3 text-sm text-[#566279]">{result.explanation}</p>
            <p className="mt-3 text-xs">Access: {result.access}</p>
            {result.sources.map((s) => (
              <div key={s.id} className="mt-4 border-t border-[#c9daee] pt-3">
                <Link
                  className="font-semibold text-[#2855f9] underline"
                  href={`/app/knowledge/${s.id}/history`}
                >
                  {s.title}
                </Link>
                <p className="mt-1 text-xs">
                  {s.status} · v{s.version} · {s.source.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </section>
        </MotionRegion>
      ) : null}
      <section aria-label="Saved tests">
        <h2 className="text-xl font-semibold">Saved tests</h2>
        <p className="mt-2 text-sm text-[#566279]">
          Rerun after linked knowledge changes. The list shows up to 50 recent
          tests.
        </p>
        {tests.length ? (
          <StaggerList changeKey={tests.map((t) => t.id).join(",")}>
            <div className="mt-4 divide-y divide-[#dfe6f0]">
              {tests.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="mt-1 break-words text-sm text-[#566279]">
                      {t.question}
                    </p>
                    <p className="mt-2 text-xs">
                      {t.needsRerun
                        ? "Needs a run · linked knowledge may have changed"
                        : t.last_result?.comparison?.passed
                          ? "Last run matched expectation"
                          : "Last run did not match expectation"}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      disabled={!!busy}
                      className="opryn-button-secondary min-h-11 px-3"
                      onClick={() => void action("rerun", t.id)}
                    >
                      Run test
                    </button>
                    <details>
                      <summary className="cursor-pointer py-3 text-sm">
                        Actions
                      </summary>
                      <button
                        disabled={!!busy}
                        className="min-h-11 px-3 text-sm text-red-700"
                        onClick={() => void action("delete", t.id)}
                      >
                        Delete saved test
                      </button>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </StaggerList>
        ) : (
          <p className="mt-4 rounded-2xl bg-[#fff4e9] p-5 text-sm">
            Save a question you rely on, with the result you expect Opryn to
            return.
          </p>
        )}
      </section>
      <Link
        href="/app/processes"
        className="inline-block min-h-11 py-3 text-sm text-[#2855f9] underline"
      >
        Back to Knowledge
      </Link>
    </div>
  );
}
