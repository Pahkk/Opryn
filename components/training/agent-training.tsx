"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { agentReadiness } from "@/lib/training/model";
import { trainingAction, TrainingStatus } from "./people-training";
type Agent = {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  status: string;
  knowledge_policy: {
    mode?: string;
    subjects?: string[];
    excludedSubjects?: string[];
    knowledgeIds?: string[];
  };
  unknown_behavior: string;
  configuration_version: number;
  behavior_rules: string;
};
type Test = {
  id: string;
  title: string;
  connection_id: string;
  question: string;
  expected_behavior: string;
  needs_rerun: boolean;
  agent_response_required?: boolean;
  agent_response_needs_update?: boolean;
  last_agent_result?: Test["last_result"];
  last_run_at: string | null;
  last_result: {
    trainingStatus?: string;
    type?: string;
    answer?: string;
    explanation?: string;
    failureCategory?: string;
    failureReason?: string;
    executionMode?: string;
    declaredSources?: Array<{ id: string; version: number }>;
    comparison?: { passed: boolean };
    sources?: Array<{ id: string; title: string; version: number }>;
  } | null;
};
type Run = {
  id: string;
  test_id: string;
  status: string;
  created_at: string;
  error_code: string | null;
  evaluation_version: number;
  configuration_version: number;
};
export function AgentTraining({
  agents,
  tests,
}: {
  agents: Agent[];
  tests: Test[];
}) {
  const [search, setSearch] = useState("");
  return (
    <section className="training-section">
      <div className="training-row">
        <div>
          <h2>Agents</h2>
          <p>Train, govern, test and update the AI you already use.</p>
        </div>
        <Link href="/app/ai-connections" className="training-button">
          Connect an agent
        </Link>
      </div>
      <p className="training-muted mt-4">
        Evaluate Opryn’s authorized answers and observable responses submitted
        by your connected agent. Each result shows what was tested. Your
        provider controls the agent’s tools.
      </p>
      <label className="training-field training-search">
        Find an agent
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {agents
        .filter((a) =>
          `${a.name} ${a.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((a) => (
          <AgentRow
            key={a.id}
            agent={a}
            tests={tests.filter((t) => t.connection_id === a.id)}
          />
        ))}
      {!agents.length && (
        <div className="training-empty">
          Connect your support, sales, onboarding or website assistant. Give it
          a purpose and choose the approved knowledge it can use.
          <br />
          <Link href="/app/ai-connections">Set up your first connection →</Link>
        </div>
      )}
    </section>
  );
}
function AgentRow({ agent: a, tests }: { agent: Agent; tests: Test[] }) {
  const [rules, setRules] = useState(a.behavior_rules);
  const router = useRouter();
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [history, setHistory] = useState<Run[] | null>(null);
  async function act(testId: string, action: "queue" | "route_gap") {
    setBusy(testId);
    setMessage("");
    try {
      const r = await trainingAction("evaluations", { testId, action });
      setMessage(
        r.message ??
          (r.routed
            ? "Question routed to the right person in Needs You."
            : "Gap recorded; this connection’s routing policy requires review."),
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveRules() {
    setBusy("rules");
    try {
      await trainingAction("agents", {
        connectionId: a.id,
        version: a.configuration_version,
        rules,
      });
      setMessage(
        "Behavior guidance saved. Share it with the connected provider and rerun evaluations.",
      );
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function loadHistory() {
    try {
      const r = await fetch(`/api/training/evaluations?connectionId=${a.id}`);
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setHistory(b.runs);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const displayedTests = tests.map((t) =>
    t.agent_response_required
      ? {
          ...t,
          needs_rerun: t.needs_rerun || !!t.agent_response_needs_update,
          last_result: t.last_agent_result ?? t.last_result,
        }
      : t,
  );
  const policy = a.knowledge_policy;
  return (
    <details className="training-learn" id={`agent-${a.id}`}>
      <summary className="cursor-pointer">
        <span className="mr-3 font-semibold">{a.name}</span>
        <TrainingStatus state={agentReadiness(a.status === "active", tests)} />
      </summary>
      <p className="training-muted mt-4">
        {a.description || "Add this agent’s purpose in connection settings."} ·{" "}
        {a.provider}
      </p>
      <div className="training-summary">
        <span>
          <strong>
            {
              displayedTests.filter(
                (t) =>
                  t.last_result?.trainingStatus === "passed" && !t.needs_rerun,
              ).length
            }
          </strong>{" "}
          passing
        </span>
        <span>
          <strong>
            {
              displayedTests.filter(
                (t) => t.last_result?.trainingStatus === "failed",
              ).length
            }
          </strong>{" "}
          failing
        </span>
        <span>
          <strong>
            {
              displayedTests.filter(
                (t) => t.last_result?.trainingStatus === "knowledge_gap",
              ).length
            }
          </strong>{" "}
          knowledge gaps
        </span>
        <span>Configuration v{a.configuration_version}</span>
      </div>
      <div className="training-grid">
        <section>
          <h3 className="font-semibold text-sm">Knowledge access</h3>
          <p className="training-muted mt-2">
            {policy.mode === "subjects"
              ? policy.subjects?.join(", ")
              : policy.mode === "items"
                ? `${policy.knowledgeIds?.length ?? 0} selected knowledge items`
                : "Connection scopes and source permissions"}
          </p>
          <p className="training-muted mt-2">
            Restricted:{" "}
            {policy.excludedSubjects?.join(", ") ||
              "Defined by connection permissions"}
          </p>
          <Link
            className="training-button secondary mt-3"
            href={`/app/ai-connections/${a.id}`}
          >
            Review permissions
          </Link>
        </section>
        <section>
          <h3 className="font-semibold text-sm">Behavior policy</h3>
          <label className="training-field">
            Instructions
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              maxLength={4000}
            />
          </label>
          <button
            className="training-button secondary"
            disabled={
              !!busy || rules.trim().length < 10 || rules === a.behavior_rules
            }
            onClick={() => void saveRules()}
          >
            Save behavior guidance
          </button>
          <p className="training-muted mt-2">
            Missing knowledge:{" "}
            {a.unknown_behavior === "route_expert"
              ? "ask the right person"
              : "record for review"}
            . Share these instructions with your provider; Opryn cannot enforce
            its tool behavior.
          </p>
        </section>
      </div>
      <div className="training-row">
        <h3 className="font-semibold">Evaluation cases</h3>
        <Link
          href={`/app/knowledge/test?connectionId=${a.id}`}
          className="training-button secondary"
        >
          Add or edit tests
        </Link>
      </div>
      {displayedTests.map((t) => (
        <article key={t.id} className="training-section">
          <div className="training-row">
            <div>
              <h3>{t.title}</h3>
              <p>
                {t.needs_rerun
                  ? "Update Required"
                  : t.last_result?.trainingStatus === "knowledge_gap"
                    ? "Knowledge gap"
                    : (t.last_result?.trainingStatus ?? "Not Tested")}
              </p>
            </div>
            <button
              className="training-button secondary"
              disabled={!!busy}
              onClick={() => void act(t.id, "queue")}
            >
              {busy === t.id ? "Queuing…" : "Queue evaluation"}
            </button>
          </div>
          <p className="training-muted mt-3">Scenario: {t.question}</p>
          <p className="training-muted mt-2">
            Expected:{" "}
            {t.expected_behavior ||
              "Set expected behavior in the saved test before claiming readiness."}
          </p>
          {t.last_result && (
            <details className="mt-3">
              <summary className="text-sm cursor-pointer">
                Inspect result
              </summary>
              <div className="training-result">
                {t.last_result.answer ||
                  t.last_result.explanation ||
                  "Evaluation needs review."}
              </div>
              <div className="training-source mt-3">
                {t.last_result.sources?.map((s) => (
                  <Link key={s.id} href={`/app/knowledge/${s.id}/impact`}>
                    {s.title} · v{s.version}
                  </Link>
                ))}
              </div>
            </details>
          )}
          {t.last_result?.trainingStatus === "knowledge_gap" && (
            <div className="training-diff">
              <strong>Knowledge gap</strong>
              <p>
                No supported answer was produced from this agent’s authorized
                knowledge. Review missing guidance and permissions before
                attributing a failure to the agent.
              </p>
              <button
                className="training-button secondary mt-3"
                disabled={!!busy}
                onClick={() => void act(t.id, "route_gap")}
              >
                Ask the right person
              </button>
              <Link
                className="training-button secondary mt-3 ml-2"
                href={`/app/processes/new?prompt=${encodeURIComponent(t.question)}`}
              >
                Teach Opryn
              </Link>
            </div>
          )}
        </article>
      ))}
      {!tests.length && (
        <p className="training-empty">
          No saved evaluations yet. Add a real business scenario to establish
          what this agent’s knowledge should support.
        </p>
      )}
      <button
        className="training-button secondary"
        onClick={() => void loadHistory()}
      >
        View recent runs
      </button>
      {history?.map((run) => (
        <p className="training-event" key={run.id}>
          {run.status.replaceAll("_", " ")}{" "}
          <span>
            · {new Date(run.created_at).toLocaleString()} · evaluation v
            {run.evaluation_version} · configuration v
            {run.configuration_version}
            {run.error_code ? ` · ${run.error_code.replaceAll("_", " ")}` : ""}
          </span>
        </p>
      ))}
      <p role="status" className="training-muted mt-4">
        {message}
      </p>
    </details>
  );
}
