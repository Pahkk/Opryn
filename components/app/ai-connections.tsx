"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  KeyRound,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { OprynEmptyState } from "@/components/opryn/opryn-empty-state";
import { OprynStatus } from "@/components/opryn/opryn-status";
import { ConnectionIcon } from "@/components/opryn-icons/opryn-icons";
import {
  EXTERNAL_AI_SCOPES,
  KNOWLEDGE_CATEGORIES,
  type ExternalAIScope,
  type ExternalAISourceType,
} from "@/lib/external-ai/constants";

type Connection = {
  id: string;
  agent_id: string;
  name: string;
  provider: string;
  description: string;
  status: "active" | "paused";
  knowledge_mode: "manual" | "all_approved";
  last_used_at: string | null;
  created_at: string;
};

export function AIConnectionsList({
  connections,
}: {
  connections: Connection[];
}) {
  if (!connections.length)
    return (
      <OprynEmptyState
        title="Connect your first AI tool."
        description="Your existing support bot, voice agent, or automation can use the same approved knowledge as your team."
        action={
          <Link href="/app/ai-connections/new" className="opryn-action">
            <ConnectionIcon size={17} /> Connect AI Agent
          </Link>
        }
      />
    );
  return (
    <div className="divide-y divide-[var(--opryn-line)] border-y border-[var(--opryn-line)] bg-white">
      {connections.map((connection) => (
        <Link
          key={connection.id}
          href={`/app/ai-connections/${connection.id}`}
          className="group flex items-center gap-4 p-5 hover:bg-[var(--opryn-blue-surface)] sm:p-6"
        >
          <span className="grid size-11 shrink-0 place-items-center border-r border-[var(--opryn-line)] pr-4 text-[var(--opryn-blue)]">
            <ConnectionIcon size={21} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-[var(--opryn-navy)]">
              {connection.name}
            </span>
            <span className="mt-1 line-clamp-1 block text-sm text-[var(--opryn-muted)]">
              {connection.description || "External AI connection"}
            </span>
            <span className="mt-2 block text-[11px] text-[var(--opryn-faint)]">
              {providerLabel(connection.provider)} ·{" "}
              {connection.last_used_at
                ? `Used ${relativeTime(connection.last_used_at)}`
                : "Not used yet"}
            </span>
          </span>
          <span className="hidden sm:block">
            <OprynStatus
              kind={connection.status === "active" ? "connected" : "draft"}
              label={connection.status === "active" ? "Connected" : "Paused"}
            />
          </span>
          <ArrowRight className="size-4 text-[var(--opryn-faint)] group-hover:translate-x-1 group-hover:text-[var(--opryn-blue)]" />
        </Link>
      ))}
    </div>
  );
}

type KnowledgeOption = { id: string; title: string; kind: "process" | "rule" };

export function NewAIConnection({
  knowledgeOptions,
}: {
  knowledgeOptions: KnowledgeOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("custom_agent");
  const [description, setDescription] = useState("");
  const [allKnowledge, setAllKnowledge] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [scopes, setScopes] = useState<ExternalAIScope[]>([
    ...EXTERNAL_AI_SCOPES,
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    connectionId: string;
    agentId: string;
    apiKey: string;
  } | null>(null);
  const access = useMemo(() => {
    const rows: Array<{ sourceType: ExternalAISourceType; sourceId?: string }> =
      [];
    for (const category of KNOWLEDGE_CATEGORIES)
      if (categories.includes(category.id))
        for (const sourceType of category.sourceTypes)
          rows.push({ sourceType });
    for (const option of knowledgeOptions)
      if (sources.includes(option.id)) {
        if (option.kind === "process") {
          rows.push({ sourceType: "process_summary", sourceId: option.id });
          rows.push({ sourceType: "process_step", sourceId: option.id });
          rows.push({ sourceType: "exception", sourceId: option.id });
        } else rows.push({ sourceType: "rule", sourceId: option.id });
      }
    return rows;
  }, [categories, knowledgeOptions, sources]);
  async function create() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/ai-connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          provider,
          description,
          knowledgeMode: allKnowledge ? "all_approved" : "manual",
          scopes,
          access,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Connection could not be created.");
      setResult(body);
      setStep(4);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Connection could not be created.",
      );
    } finally {
      setSaving(false);
    }
  }
  const canContinue =
    step === 1
      ? name.trim().length >= 2
      : step === 2
        ? allKnowledge || access.length > 0
        : scopes.includes("knowledge:read");
  return (
    <section className="mx-auto max-w-3xl rounded-3xl border border-[#dfe5ed] bg-white p-5 sm:p-8">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((number) => (
          <span
            key={number}
            className={`h-1.5 flex-1 rounded-full transition ${number <= step ? "bg-[#3158d8]" : "bg-[#e8ecf2]"}`}
          />
        ))}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[.12em] text-[#3158d8]">
        Step {step} of 4
      </p>
      {step === 1 ? (
        <div className="mt-4 space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">
              Tell us what you are connecting.
            </h2>
            <p className="mt-2 text-sm text-[#6c798c]">
              This labels the connection. It does not install or create the
              external agent.
            </p>
          </div>
          <Field label="Connection name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website Support Agent"
              className={inputClass}
            />
          </Field>
          <Field label="Provider">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={inputClass}
            >
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="voice_agent">Voice Agent</option>
              <option value="website_chatbot">Website Chatbot</option>
              <option value="custom_agent">Custom Agent</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Answers website customer questions using approved Opryn knowledge."
              className={`${inputClass} min-h-24 py-3`}
            />
          </Field>
        </div>
      ) : null}
      {step === 2 ? (
        <div className="mt-4">
          <h2 className="text-2xl font-semibold">Choose what it can know.</h2>
          <p className="mt-2 text-sm text-[#6c798c]">
            Nothing is shared until you select it. Draft and observed knowledge
            always stay private.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfe5ed] p-4">
            <input
              type="checkbox"
              checked={allKnowledge}
              onChange={(e) => setAllKnowledge(e.target.checked)}
              className="mt-1 size-4 accent-[#3158d8]"
            />
            <span>
              <strong className="block text-sm">
                Use all approved knowledge
              </strong>
              <span className="mt-1 block text-xs text-[#748195]">
                Includes future approved knowledge. Best only for highly trusted
                internal agents.
              </span>
            </span>
          </label>
          {!allKnowledge ? (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-[.1em] text-[#687589]">
                Knowledge categories
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {KNOWLEDGE_CATEGORIES.map((category) => (
                  <CheckCard
                    key={category.id}
                    checked={categories.includes(category.id)}
                    title={category.label}
                    copy={category.description}
                    onChange={() =>
                      setCategories(toggle(categories, category.id))
                    }
                  />
                ))}
              </div>
              {knowledgeOptions.length ? (
                <>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[.1em] text-[#687589]">
                    Specific approved sources
                  </p>
                  <div className="mt-3 max-h-56 space-y-2 overflow-auto rounded-xl border border-[#e1e6ed] p-2">
                    {knowledgeOptions.map((option) => (
                      <label
                        key={`${option.kind}-${option.id}`}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#f7f9fc]"
                      >
                        <input
                          type="checkbox"
                          checked={sources.includes(option.id)}
                          onChange={() =>
                            setSources(toggle(sources, option.id))
                          }
                          className="size-4 accent-[#3158d8]"
                        />
                        <span className="text-sm">{option.title}</span>
                        <span className="ml-auto text-[10px] uppercase text-[#8490a1]">
                          {option.kind}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
      {step === 3 ? (
        <div className="mt-4">
          <h2 className="text-2xl font-semibold">Set the allowed actions.</h2>
          <p className="mt-2 text-sm text-[#6c798c]">
            V1 is read-only. Connections cannot change company knowledge,
            people, settings, or billing.
          </p>
          <div className="mt-5 space-y-2">
            {EXTERNAL_AI_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e1e6ed] p-4"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() =>
                    setScopes(toggle(scopes, scope) as ExternalAIScope[])
                  }
                  className="size-4 accent-[#3158d8]"
                />
                <span>
                  <strong className="block font-mono text-xs">{scope}</strong>
                  <span className="mt-1 block text-xs text-[#748195]">
                    {scopeDescription(scope)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {step === 4 && result ? (
        <div className="mt-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf7f1] text-[#177257]">
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="mt-5 text-2xl font-semibold">Connection ready.</h2>
          <p className="mt-2 text-sm text-[#6c798c]">
            Copy this key now. You will not be able to view it again.
          </p>
          <Secret label="Agent ID" value={result.agentId} />
          <Secret label="API Key" value={result.apiKey} />
          <button
            onClick={() =>
              router.push(`/app/ai-connections/${result.connectionId}`)
            }
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white"
          >
            Open connection <ArrowRight className="size-4" />
          </button>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-[#fff1f0] p-3 text-sm text-[#a23b35]"
        >
          {error}
        </p>
      ) : null}
      {step < 4 ? (
        <div className="mt-8 flex justify-between border-t border-[#edf0f4] pt-5">
          <button
            disabled={step === 1}
            onClick={() => setStep(step - 1)}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[#667386] disabled:opacity-0"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
              className="min-h-11 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              disabled={!canContinue || saving}
              onClick={() => void create()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}{" "}
              Generate API Key
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function ConnectionDetail({
  connection,
  scopes,
  access,
  activity,
  escalations,
  keyPrefix,
  stats,
}: {
  connection: Connection;
  scopes: string[];
  access: Array<{
    source_type: ExternalAISourceType;
    source_id: string | null;
  }>;
  activity: Array<{
    id: string;
    endpoint: string;
    result_status: string;
    source_count: number;
    created_at: string;
  }>;
  escalations: Array<{
    id: string;
    question: string;
    context: string;
    status: string;
    resolution: string | null;
    proposed_rule: string | null;
    created_at: string;
  }>;
  keyPrefix: string | null;
  stats: {
    queries: number;
    answered: number;
    unknown: number;
    escalated: number;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [settingsName, setSettingsName] = useState(connection.name);
  const [settingsDescription, setSettingsDescription] = useState(
    connection.description,
  );
  const [settingsScopes, setSettingsScopes] = useState<ExternalAIScope[]>(
    scopes.filter((scope): scope is ExternalAIScope =>
      EXTERNAL_AI_SCOPES.includes(scope as ExternalAIScope),
    ),
  );
  const [allKnowledgeSetting, setAllKnowledgeSetting] = useState(
    connection.knowledge_mode === "all_approved",
  );
  const [categorySettings, setCategorySettings] = useState<string[]>(() =>
    KNOWLEDGE_CATEGORIES.filter((category) =>
      category.sourceTypes.every((sourceType) =>
        access.some(
          (item) => item.source_type === sourceType && item.source_id === null,
        ),
      ),
    ).map((category) => category.id),
  );
  async function action(path: string, body?: unknown) {
    setBusy(path);
    setMessage("");
    try {
      const response = await fetch(
        `/api/ai-connections/${connection.id}${path}`,
        {
          method: "POST",
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.apiKey) setSecret(data.apiKey);
      setMessage(
        path.includes("rotate") ? "New key created. Copy it now." : "Saved.",
      );
      router.refresh();
      return data;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not complete that action.",
      );
    } finally {
      setBusy("");
    }
  }
  async function setPaused() {
    await fetch(`/api/ai-connections/${connection.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: connection.status === "active" ? "paused" : "active",
      }),
    });
    router.refresh();
  }
  async function saveSettings(payload: Record<string, unknown>) {
    setBusy("settings");
    setMessage("");
    try {
      const response = await fetch(`/api/ai-connections/${connection.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage("Connection settings saved.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Settings could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }
  async function remove() {
    if (!window.confirm("Delete this connection and revoke all of its keys?"))
      return;
    const response = await fetch(`/api/ai-connections/${connection.id}`, {
      method: "DELETE",
    });
    if (response.ok) router.push("/app/integrations?filter=ai");
  }
  const baseUrl =
    typeof window === "undefined"
      ? "https://www.opryn.app/api/v1"
      : `${window.location.origin}/api/v1`;
  const curl = `curl -X POST ${baseUrl}/answer \\\n  -H "Authorization: Bearer YOUR_OPRYN_AGENT_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"question":"Can this customer get a 15% discount?"}'`;
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-[#dfe5ed]">
        {[
          "overview",
          "knowledge",
          "api",
          "activity",
          "escalations",
          "settings",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-3 text-sm font-semibold capitalize ${tab === item ? "border-[#3158d8] text-[#3158d8]" : "border-transparent text-[#6c798c]"}`}
          >
            {item === "api" ? "API Access" : item}
          </button>
        ))}
      </div>
      {message ? (
        <p className="mt-4 rounded-xl bg-[#eef6ff] p-3 text-sm text-[#3158d8]">
          {message}
        </p>
      ) : null}
      {tab === "overview" ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
            <h2 className="font-semibold">Connection overview</h2>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <Stat label="Queries · 7 days" value={stats.queries} />
              <Stat label="Answered" value={stats.answered} />
              <Stat label="Unknown" value={stats.unknown} />
              <Stat label="Escalated" value={stats.escalated} />
            </dl>
          </section>
          <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
            <h2 className="font-semibold">Access summary</h2>
            <p className="mt-4 text-sm text-[#6c798c]">
              {connection.knowledge_mode === "all_approved"
                ? "All approved company knowledge"
                : `${access.length} knowledge permission${access.length === 1 ? "" : "s"}`}
            </p>
            <p className="mt-3 text-sm text-[#6c798c]">
              {scopes.length} API scopes
            </p>
            <p className="mt-3 text-xs text-[#8a95a5]">
              Last used:{" "}
              {connection.last_used_at
                ? new Date(connection.last_used_at).toLocaleString()
                : "Never"}
            </p>
          </section>
        </div>
      ) : null}
      {tab === "knowledge" ? (
        <section className="mt-5 rounded-2xl border border-[#dfe5ed] bg-white p-5">
          <h2 className="font-semibold">Knowledge Access</h2>
          <p className="mt-2 text-sm text-[#6c798c]">
            Only approved knowledge matching these permissions can leave Opryn.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfe5ed] p-4">
            <input
              type="checkbox"
              checked={allKnowledgeSetting}
              onChange={(event) => setAllKnowledgeSetting(event.target.checked)}
              className="mt-1 size-4 accent-[#3158d8]"
            />
            <span>
              <strong className="block text-sm">
                Use all approved knowledge
              </strong>
              <span className="mt-1 block text-xs text-[#748195]">
                Also grants access to knowledge approved in the future.
              </span>
            </span>
          </label>
          {!allKnowledgeSetting ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {KNOWLEDGE_CATEGORIES.map((category) => (
                <CheckCard
                  key={category.id}
                  checked={categorySettings.includes(category.id)}
                  title={category.label}
                  copy={category.description}
                  onChange={() =>
                    setCategorySettings(toggle(categorySettings, category.id))
                  }
                />
              ))}
            </div>
          ) : null}
          <button
            disabled={busy === "settings"}
            onClick={() => {
              const categoryRows = KNOWLEDGE_CATEGORIES.filter((category) =>
                categorySettings.includes(category.id),
              ).flatMap((category) =>
                category.sourceTypes.map((sourceType) => ({ sourceType })),
              );
              const specificallySelected = access
                .filter((item) => item.source_id)
                .map((item) => ({
                  sourceType: item.source_type,
                  sourceId: item.source_id,
                }));
              void saveSettings({
                knowledgeMode: allKnowledgeSetting ? "all_approved" : "manual",
                access: [...categoryRows, ...specificallySelected],
              });
            }}
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "settings" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Save knowledge access
          </button>
        </section>
      ) : null}
      {tab === "api" ? (
        <div className="mt-5 space-y-5">
          <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
            <h2 className="font-semibold">API credentials</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Secret label="Base URL" value={baseUrl} />
              <Secret label="Agent ID" value={connection.agent_id} />
              <Secret label="API Key" value={secret ?? keyPrefix ?? "Hidden"} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                disabled={busy === "/rotate"}
                onClick={() => void action("/rotate")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white"
              >
                <RefreshCw className="size-4" /> Rotate Key
              </button>
              <button
                onClick={() => void action("/revoke")}
                className="min-h-10 rounded-xl border border-[#d9e0e9] px-4 text-sm font-semibold"
              >
                Revoke Key
              </button>
            </div>
          </section>
          <section className="rounded-2xl bg-[#111d34] p-5 text-white">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Example request</h2>
              <CopyButton value={curl} />
            </div>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-[#c1cee3]">
              {curl}
            </pre>
          </section>
        </div>
      ) : null}
      {tab === "activity" ? (
        <section className="mt-5 rounded-2xl border border-[#dfe5ed] bg-white p-5">
          <h2 className="font-semibold">Recent activity</h2>
          <div className="mt-4 divide-y divide-[#edf0f4]">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-4">
                  <span className="grid size-9 place-items-center rounded-lg bg-[#f1f4f8] text-[#53647e]">
                    <Activity className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">
                      {item.endpoint.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-[#7b8797]">
                      {new Date(item.created_at).toLocaleString()} ·{" "}
                      {item.source_count} sources
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.result_status === "answered" || item.result_status === "created" ? "bg-[#eaf7f1] text-[#177257]" : "bg-[#f2f3f5] text-[#697486]"}`}
                  >
                    {item.result_status}
                  </span>
                </div>
              ))
            ) : (
              <p className="py-7 text-sm text-[#748195]">
                Requests will appear here after the agent uses Opryn.
              </p>
            )}
          </div>
        </section>
      ) : null}
      {tab === "escalations" ? (
        <section className="mt-5 rounded-2xl border border-[#dfe5ed] bg-white p-5">
          <h2 className="font-semibold">AI Needs You</h2>
          <p className="mt-2 text-sm text-[#6c798c]">
            Answer unknown questions once, then choose whether Opryn should
            learn the answer.
          </p>
          <div className="mt-5 space-y-3">
            {escalations.length ? (
              escalations.map((item) => (
                <EscalationCard
                  key={item.id}
                  connectionId={connection.id}
                  item={item}
                  onDone={() => router.refresh()}
                />
              ))
            ) : (
              <p className="rounded-xl bg-[#f7f9fc] p-5 text-sm text-[#748195]">
                No questions are waiting for you.
              </p>
            )}
          </div>
        </section>
      ) : null}
      {tab === "settings" ? (
        <section className="mt-5 rounded-2xl border border-[#dfe5ed] bg-white p-5">
          <h2 className="font-semibold">Connection settings</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Connection name">
              <input
                value={settingsName}
                onChange={(event) => setSettingsName(event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Description">
              <input
                value={settingsDescription}
                onChange={(event) => setSettingsDescription(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.1em] text-[#687589]">
            API scopes
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXTERNAL_AI_SCOPES.map((scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e1e6ed] p-3"
              >
                <input
                  type="checkbox"
                  checked={settingsScopes.includes(scope)}
                  onChange={() =>
                    setSettingsScopes(
                      toggle(settingsScopes, scope) as ExternalAIScope[],
                    )
                  }
                  className="size-4 accent-[#3158d8]"
                />
                <code className="text-xs">{scope}</code>
              </label>
            ))}
          </div>
          <button
            disabled={
              !settingsName.trim() ||
              !settingsScopes.length ||
              busy === "settings"
            }
            onClick={() =>
              void saveSettings({
                name: settingsName,
                description: settingsDescription,
                scopes: settingsScopes,
              })
            }
            className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy === "settings" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Save settings
          </button>
          <div className="mt-8 border-t border-[#edf0f4] pt-5">
            <h3 className="text-sm font-semibold">Connection controls</h3>
            <p className="mt-2 text-sm text-[#6c798c]">
              Pausing blocks every request immediately without deleting history.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => void setPaused()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d9e0e9] px-4 text-sm font-semibold"
              >
                {connection.status === "active" ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {connection.status === "active"
                  ? "Pause connection"
                  : "Resume connection"}
              </button>
              <button
                onClick={() => void remove()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#f0c7c4] px-4 text-sm font-semibold text-[#a13d36]"
              >
                <Trash2 className="size-4" /> Delete connection
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EscalationCard({
  connectionId,
  item,
  onDone,
}: {
  connectionId: string;
  item: {
    id: string;
    question: string;
    context: string;
    status: string;
    resolution: string | null;
    proposed_rule: string | null;
    created_at: string;
  };
  onDone: () => void;
}) {
  const [answer, setAnswer] = useState(item.resolution ?? "");
  const [rule, setRule] = useState(item.proposed_rule ?? "");
  const [stage, setStage] = useState(item.proposed_rule ? "review" : "answer");
  const [clarificationQuestions, setClarificationQuestions] = useState<
    string[]
  >([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});
  const [busy, setBusy] = useState(false);
  async function submit(
    action: "suggest" | "approve" | "answer_only" | "dismiss",
  ) {
    setBusy(true);
    const response = await fetch(
      `/api/ai-connections/${connectionId}/escalations/${item.id}/answer`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          answer,
          rule,
          clarificationAnswers: clarificationQuestions.map((question) => ({
            question,
            answer: clarificationAnswers[question] || "",
          })),
        }),
      },
    );
    const data = await response.json();
    if (response.ok && action === "suggest") {
      setRule(data.rule);
      if (data.complete === false) {
        setClarificationQuestions(data.clarificationQuestions ?? []);
        setStage("clarify");
      } else {
        setStage("review");
      }
    } else if (response.ok) onDone();
    setBusy(false);
  }
  return (
    <article className="rounded-xl border border-[#e1e6ed] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.question}</p>
          {item.context ? (
            <p className="mt-2 text-xs leading-5 text-[#778496]">
              Context: {item.context}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] text-[#8792a2]">
          {new Date(item.created_at).toLocaleDateString()}
        </span>
      </div>
      {item.status === "open" ? (
        stage === "answer" ? (
          <div className="mt-4">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write the owner's answer…"
              className={`${inputClass} min-h-24 py-3`}
            />
            <div className="mt-2 flex gap-2">
              <button
                disabled={!answer.trim() || busy}
                onClick={() => void submit("suggest")}
                className="rounded-lg bg-[#3158d8] px-3 py-2 text-xs font-semibold text-white"
              >
                Answer &amp; review rule
              </button>
              <button
                onClick={() => void submit("dismiss")}
                className="px-3 py-2 text-xs font-semibold text-[#7b8797]"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : stage === "clarify" ? (
          <div className="mt-4 rounded-xl border border-[#ead9ae] bg-[#fffdf7] p-4">
            <p className="text-xs font-bold uppercase text-[#8c641f]">
              Opryn needs a little more detail
            </p>
            <div className="mt-3 space-y-3">
              {clarificationQuestions.map((question) => (
                <label
                  key={question}
                  className="block text-xs font-semibold text-[#536176]"
                >
                  {question}
                  <input
                    value={clarificationAnswers[question] || ""}
                    onChange={(event) =>
                      setClarificationAnswers((current) => ({
                        ...current,
                        [question]: event.target.value,
                      }))
                    }
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ))}
            </div>
            <button
              disabled={
                busy ||
                clarificationQuestions.some(
                  (question) => !clarificationAnswers[question]?.trim(),
                )
              }
              onClick={() => void submit("suggest")}
              className="mt-3 rounded-lg bg-[#3158d8] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-[#f7f9fc] p-4">
            <p className="text-xs font-bold uppercase text-[#177257]">
              Suggested company rule
            </p>
            <textarea
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              className={`${inputClass} mt-3 min-h-20 py-3`}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={!rule.trim() || busy}
                onClick={() => void submit("approve")}
                className="rounded-lg bg-[#177257] px-3 py-2 text-xs font-semibold text-white"
              >
                Remember It
              </button>
              <button
                onClick={() => void submit("answer_only")}
                className="rounded-lg border border-[#d8dfe8] px-3 py-2 text-xs font-semibold"
              >
                Just Answer
              </button>
            </div>
          </div>
        )
      ) : (
        <p className="mt-3 text-xs text-[#177257]">
          {item.status === "answered" ? "Answered" : "Dismissed"}
        </p>
      )}
    </article>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}
function CheckCard({
  checked,
  title,
  copy,
  onChange,
}: {
  checked: boolean;
  title: string;
  copy: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-start gap-3 rounded-xl border p-4 text-left ${checked ? "border-[#3158d8] bg-[#f4f7ff]" : "border-[#dfe5ed]"}`}
    >
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${checked ? "border-[#3158d8] bg-[#3158d8] text-white" : "border-[#cbd4df]"}`}
      >
        {checked ? <Check className="size-3" /> : null}
      </span>
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs leading-5 text-[#748195]">
          {copy}
        </span>
      </span>
    </button>
  );
}
function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 rounded-xl border border-[#dfe5ed] bg-[#f8fafc] p-4 text-left">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#7b8797]">
            {label}
          </p>
          <code className="mt-2 block truncate text-xs text-[#28364b]">
            {value}
          </code>
        </div>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
      className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-[#8fa3c4] hover:text-white"
    >
      {copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}
    </button>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-4">
      <strong className="text-2xl">{value}</strong>
      <p className="mt-1 text-xs text-[#758296]">{label}</p>
    </div>
  );
}
function toggle<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
function providerLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function relativeTime(value: string) {
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(value).getTime()) / 60000),
  );
  return minutes < 60
    ? `${minutes}m ago`
    : minutes < 1440
      ? `${Math.round(minutes / 60)}h ago`
      : `${Math.round(minutes / 1440)}d ago`;
}
function scopeDescription(scope: string) {
  return (
    {
      "knowledge:read": "Ask grounded questions and search selected knowledge.",
      "processes:read": "Read permitted approved process content.",
      "policies:read": "Read permitted approved company rules.",
      "sources:read": "Receive source references with answers.",
      "escalations:create": "Send unknown questions to the owner.",
    } as Record<string, string>
  )[scope];
}
const inputClass =
  "w-full rounded-xl border border-[#d7dfe9] bg-white px-3.5 text-sm outline-none transition focus:border-[#3158d8] focus:ring-4 focus:ring-[#3158d8]/10";
