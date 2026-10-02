"use client";
import { suggestedPractice } from "@/lib/training/drafts";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  knowledgeReadiness,
  knowledgeTitle,
  type TrainingKnowledge,
  type KnowledgeAssignment,
  type TrainingScenario,
} from "@/lib/training/model";
export async function trainingAction(path: string, body: unknown) {
  const r = await fetch(`/api/training/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const b = await r.json();
  if (!r.ok)
    throw new Error(b.error || "This training action could not complete.");
  return b;
}
export function TrainingStatus({ state }: { state: string }) {
  return (
    <span className="training-status" data-state={state}>
      {state}
    </span>
  );
}
export function EmployeeLearning({
  assignments,
  knowledge,
  scenarios,
  previous,
  stages = {},
}: {
  stages?: Record<string, string>;
  assignments: KnowledgeAssignment[];
  knowledge: TrainingKnowledge[];
  scenarios: TrainingScenario[];
  previous: Record<string, string>;
}) {
  return (
    <section className="training-section">
      <h2>What you need to know</h2>
      <p>
        Learn the approved guidance. Practice applying it. Stay current when it
        changes.
      </p>
      {!assignments.length ? (
        <div className="training-empty">
          No required knowledge yet. Your role’s essentials will appear here.
          <br />
          <Link href="/app/ask">Ask Opryn →</Link>
        </div>
      ) : (
        assignments.map((a) => (
          <LearningRow
            key={`${a.id}-${a.required_version}`}
            assignment={a}
            knowledge={knowledge.find((k) => k.id === a.knowledge_chunk_id)}
            scenario={scenarios.find(
              (s) =>
                s.knowledge_chunk_id === a.knowledge_chunk_id &&
                s.status === "approved",
            )}
            previous={previous[a.knowledge_chunk_id]}
            stage={stages[a.knowledge_chunk_id]}
          />
        ))
      )}
      <p className="training-muted">
        Ready means the assigned acknowledgement and practice checks are
        complete for this version. It does not certify job performance.
      </p>
    </section>
  );
}
function LearningRow({
  assignment: a,
  knowledge: k,
  scenario,
  previous,
  stage,
}: {
  stage?: string;
  assignment: KnowledgeAssignment;
  knowledge?: TrainingKnowledge;
  scenario?: TrainingScenario;
  previous?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [response, setResponse] = useState(""),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState(""),
    [reason, setReason] = useState("missing_information"),
    [note, setNote] = useState("");
  const state = knowledgeReadiness(a, k, scenario);
  async function act(action: "acknowledge" | "practice") {
    if (!k || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const b = await trainingAction("practice", {
        assignmentId: a.id,
        version: k.current_version,
        action,
        ...(action === "practice" ? { response } : {}),
      });
      setFeedback(b.feedback?.feedback ?? "");
      setMessage(
        action === "acknowledge"
          ? "Current guidance acknowledged."
          : b.outcome === "supported"
            ? "This response is supported by the approved guidance."
            : "Review the guidance and try again.",
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function report() {
    if (!k || busy) return;
    setBusy(true);
    try {
      await trainingAction("feedback", { knowledgeId: k.id, reason, note });
      setMessage("Sent to Needs You for knowledge review.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="training-learn" id={`assignment-${a.id}`}>
      <TrainingStatus state={state} />
      {stage && (
        <span className="training-muted ml-3">
          {stage === "day_one"
            ? "Day 1 essentials"
            : stage === "advanced"
              ? "Next up"
              : "Role knowledge"}
        </span>
      )}
      <h2>{k ? knowledgeTitle(k) : "Guidance unavailable"}</h2>
      {k ? (
        <>
          <div className="training-source">
            <span>Approved · Version {k.current_version}</span>
            <span>{k.source_type.replaceAll("_", " ")}</span>
            <Link
              href={
                k.process_id
                  ? `/app/processes/${k.process_id}`
                  : `/app/training/knowledge/${k.id}`
              }
            >
              View source
            </Link>
          </div>
          {a.update_required && (
            <div className="training-diff">
              <strong>What changed</strong>
              {previous ? (
                <>
                  <p>Before</p>
                  <p>{previous}</p>
                </>
              ) : (
                <p>
                  The previous version is unavailable under your current access.
                  Read the current guidance below.
                </p>
              )}
              <p className="mt-3 font-semibold">
                Now · Version {k.current_version}
              </p>
              <p>{k.content}</p>
            </div>
          )}
          {!a.update_required && (
            <p className="training-guidance">{k.content}</p>
          )}
          <div className="training-actions">
            <button
              className="training-button"
              disabled={
                busy ||
                (a.acknowledged_version === k.current_version &&
                  !a.update_required)
              }
              onClick={() => void act("acknowledge")}
            >
              {busy
                ? "Saving…"
                : a.update_required
                  ? "Got it — acknowledge update"
                  : "I understand this guidance"}
            </button>
          </div>
          {scenario && scenario.format !== "acknowledgement" ? (
            <details className="mt-6" open={state === "Practice Needed"}>
              <summary>
                Practice{" "}
                {a.update_required ? "the update" : "applying this guidance"}
              </summary>
              <p className="mt-4 text-sm leading-7">{scenario.prompt}</p>
              <label className="training-field">
                Your response
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  maxLength={3000}
                />
              </label>
              <button
                className="training-button secondary"
                disabled={busy || response.trim().length < 10}
                onClick={() => void act("practice")}
              >
                {busy ? "Checking guidance…" : "Check my response"}
              </button>
              {feedback && <div className="training-result">{feedback}</div>}
            </details>
          ) : !scenario ? (
            <p className="training-muted mt-4">
              Practice for this version is awaiting review. You can acknowledge
              the guidance now.
            </p>
          ) : null}
          <details className="mt-6">
            <summary className="text-sm">Something unclear?</summary>
            <label className="training-field">
              What needs review?
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="missing_information">This is unclear</option>
                <option value="outdated">This seems outdated</option>
                <option value="wrong_policy">
                  I was told something different
                </option>
                <option value="other">This does not apply to my role</option>
              </select>
            </label>
            <label className="training-field">
              Details (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
              />
            </label>
            <button
              className="training-button secondary"
              disabled={busy}
              onClick={() => void report()}
            >
              Request knowledge review
            </button>
          </details>
        </>
      ) : (
        <p className="training-muted">
          This item is restricted, retired, or needs human review. Your previous
          progress is preserved.
        </p>
      )}
      <p role="status" aria-live="polite" className="training-muted mt-4">
        {message}
      </p>
    </article>
  );
}
export function TrainingConfiguration({
  knowledge,
  roles,
}: {
  knowledge: TrainingKnowledge[];
  roles: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [role, setRole] = useState(roles[0]?.id ?? ""),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [stage, setStage] = useState("core"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [item, setItem] = useState(""),
    [format, setFormat] = useState("scenario"),
    [prompt, setPrompt] = useState(""),
    [quote, setQuote] = useState("");
  const k = knowledge.find((x) => x.id === item);
  async function save(kind: "knowledge" | "scenarios") {
    setBusy(true);
    setMessage("");
    try {
      await trainingAction(
        kind,
        kind === "knowledge"
          ? { roleId: role, knowledgeIds: selected, stage }
          : {
              knowledgeId: item,
              version: k?.current_version,
              format,
              prompt,
              supportingQuote: quote,
            },
      );
      setMessage(
        kind === "knowledge"
          ? "Role requirements assigned. Current and future role members receive this guidance."
          : "Practice approved for the current knowledge version.",
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <details className="training-config">
        <summary>Assign role knowledge</summary>
        <p className="training-muted mt-3">
          Choose what this role needs. Assignments always reference the approved
          version.
        </p>
        <div className="training-grid">
          <label className="training-field">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Choose a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="training-field">
            When to learn
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option value="day_one">Day 1 essentials</option>
              <option value="core">Core role knowledge</option>
              <option value="advanced">Next up / advanced</option>
            </select>
          </label>
        </div>
        <label className="training-field">
          Find approved knowledge
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
          />
        </label>
        <div className="training-checks">
          {knowledge
            .filter(
              (k) =>
                (!k.role_id || k.role_id === role) &&
                k.content.toLowerCase().includes(query.toLowerCase()),
            )
            .map((k) => (
              <label key={k.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(k.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(k.id)
                        ? s.filter((id) => id !== k.id)
                        : [...s, k.id],
                    )
                  }
                />
                <span>
                  {knowledgeTitle(k)} <small>· v{k.current_version}</small>
                </span>
              </label>
            ))}
        </div>
        <button
          className="training-button"
          disabled={busy || !role || !selected.length}
          onClick={() => void save("knowledge")}
        >
          Apply requirements
        </button>
        <Link className="training-button secondary ml-2" href="/app/roles">
          Manage roles
        </Link>
      </details>
      <details className="training-config">
        <summary>Review practice for approved knowledge</summary>
        <p className="training-muted mt-3">
          Write a practical situation, or use acknowledgement when a quiz is
          unnecessary. The expected guidance must be an exact excerpt of
          approved knowledge.
        </p>
        <label className="training-field">
          Approved knowledge
          <select
            aria-label="Approved knowledge"
            value={item}
            onChange={(e) => {
              setItem(e.target.value);
              setQuote("");
            }}
          >
            <option value="">Choose knowledge</option>
            {knowledge.map((k) => (
              <option key={k.id} value={k.id}>
                {knowledgeTitle(k)}
              </option>
            ))}
          </select>
        </label>
        {k && (
          <>
            <blockquote className="training-result">{k.content}</blockquote>
            <button
              type="button"
              className="training-button secondary mt-3"
              onClick={() => {
                const draft = suggestedPractice(k);
                setFormat(draft.format);
                setPrompt(draft.prompt);
                setQuote(draft.quote);
              }}
            >
              Suggest grounded practice
            </button>
          </>
        )}
        <label className="training-field">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            {[
              "scenario",
              "acknowledgement",
              "short_answer",
              "recognition",
              "step_order",
              "responsibility",
            ].map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="training-field">
          {format === "acknowledgement"
            ? "What to acknowledge"
            : "Practice situation / question"}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={2000}
          />
        </label>
        <label className="training-field">
          Supporting excerpt from approved guidance
          <textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={4000}
          />
        </label>
        <p className="training-muted">
          Confirm that the exercise introduces no new company rule before
          approving.
        </p>
        <button
          className="training-button mt-3"
          disabled={
            busy ||
            !k ||
            !quote.trim() ||
            !k.content.includes(quote) ||
            prompt.trim().length < 3
          }
          onClick={() => void save("scenarios")}
        >
          Approve practice
        </button>
      </details>
      <p role="status" className="training-muted">
        {message}
      </p>
    </>
  );
}
