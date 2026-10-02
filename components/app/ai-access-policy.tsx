"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-library";
import { externalKnowledgePolicySchema } from "@/lib/external-ai/policy";
import { MotionRegion } from "@/components/motion/motion-region";
export function AIAccessPolicy({
  connection,
  knowledge,
  limited,
}: {
  connection: {
    id: string;
    updated_at: string;
    knowledge_policy: unknown;
    unknown_behavior: string;
    activity_retention_days: number;
  };
  knowledge: Array<{
    id: string;
    content: string;
    library_category: string;
    current_version: number;
  }>;
  limited: boolean;
}) {
  const router = useRouter();
  const initial = externalKnowledgePolicySchema.parse(
    connection.knowledge_policy,
  );
  const [policy, setPolicy] = useState(initial);
  const [unknown, setUnknown] = useState(connection.unknown_behavior);
  const [retention, setRetention] = useState(
    connection.activity_retention_days,
  );
  const [updated, setUpdated] = useState(connection.updated_at);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  function toggle(
    field: "subjects" | "excludedSubjects",
    value: keyof typeof KNOWLEDGE_CATEGORIES,
  ) {
    setPolicy((p) => ({
      ...p,
      [field]: p[field].includes(value)
        ? p[field].filter((v) => v !== value)
        : [...p[field], value],
    }));
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/ai-connections/${connection.id}/policy`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policy,
          expectedUpdatedAt: updated,
          unknownBehavior: unknown,
          retentionDays: retention,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setUpdated(b.updatedAt);
      setMessage(
        "Access settings saved. Test the connection before relying on it.",
      );
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Access could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MotionRegion
      variant="quiet"
      className="my-6 rounded-3xl border border-[#dbe5f2] bg-white p-5 sm:p-7"
    >
      <h2 className="text-2xl font-semibold tracking-tight">
        What this AI can know
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#566279]">
        These controls narrow the connection’s existing knowledge categories and
        API scopes. Only approved, applicable guidance can be used.
      </p>
      <fieldset disabled={busy} className="mt-5 space-y-5">
        <legend className="sr-only">AI knowledge access policy</legend>
        <label className="block text-sm font-semibold">
          Knowledge access
          <select
            className="opryn-input mt-2 w-full"
            value={policy.mode}
            onChange={(e) =>
              setPolicy((p) => ({
                ...p,
                mode: e.target.value as typeof p.mode,
              }))
            }
          >
            <option value="inherit">Keep existing access</option>
            <option value="subjects">Selected knowledge areas</option>
            <option value="items">Selected knowledge items</option>
          </select>
        </label>
        {policy.mode === "subjects" && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Allowed areas
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(KNOWLEDGE_CATEGORIES).map(([id, label]) => (
                <label
                  key={id}
                  className="flex min-h-11 items-center gap-3 rounded-xl bg-[#EAF4FF] px-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={policy.subjects.includes(
                      id as keyof typeof KNOWLEDGE_CATEGORIES,
                    )}
                    onChange={() =>
                      toggle(
                        "subjects",
                        id as keyof typeof KNOWLEDGE_CATEGORIES,
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {policy.mode === "items" && (
          <div>
            <label className="block text-sm font-semibold">
              Find approved knowledge
              <input
                className="opryn-input mt-2 w-full"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search knowledge…"
              />
            </label>
            <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-[#dbe5f2]">
              {knowledge
                .filter((k) =>
                  k.content.toLowerCase().includes(query.toLowerCase()),
                )
                .map((k) => (
                  <label
                    key={k.id}
                    className="flex min-h-14 items-center gap-3 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={policy.knowledgeIds.includes(k.id)}
                      onChange={() =>
                        setPolicy((p) => ({
                          ...p,
                          knowledgeIds: p.knowledgeIds.includes(k.id)
                            ? p.knowledgeIds.filter((id) => id !== k.id)
                            : [...p.knowledgeIds, k.id],
                        }))
                      }
                    />
                    <span className="min-w-0 break-words">
                      {k.content.split(/[\n:]/)[0].slice(0, 120)}{" "}
                      <span className="text-xs text-[#566279]">
                        v{k.current_version}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
            {limited && (
              <p className="mt-2 text-xs">
                First 500 approved items shown. Existing selections outside this
                list are retained.
              </p>
            )}
            <p className="mt-2 text-xs text-[#566279]">
              {policy.knowledgeIds.length} selected. An empty selection allows
              no items.
            </p>
          </div>
        )}
        <details>
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">
            Exclude knowledge areas
          </summary>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(KNOWLEDGE_CATEGORIES).map(([id, label]) => (
              <label
                key={id}
                className="flex min-h-11 items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={policy.excludedSubjects.includes(
                    id as keyof typeof KNOWLEDGE_CATEGORIES,
                  )}
                  onChange={() =>
                    toggle(
                      "excludedSubjects",
                      id as keyof typeof KNOWLEDGE_CATEGORIES,
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </details>
        <label className="block text-sm font-semibold">
          When an answer is unknown
          <select
            className="opryn-input mt-2 w-full"
            value={unknown}
            onChange={(e) => setUnknown(e.target.value)}
          >
            <option value="route_expert">Expert, then workspace owner</option>
            <option value="record_only">
              Record a gap without notifying a human
            </option>
          </select>
          <span className="mt-2 block text-xs font-normal text-[#566279]">
            Routing still requires escalation permission and workspace
            escalation settings.
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Keep lookup metadata for
          <input
            type="number"
            min={7}
            max={365}
            className="opryn-input mx-2 w-24"
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
          />
          days
          <span className="mt-2 block text-xs font-normal text-[#566279]">
            Daily cleanup removes expired lookup logs—not knowledge, gaps, or
            approval history.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="opryn-action" onClick={() => void save()}>
            {busy ? "Saving…" : "Save AI access"}
          </button>
          <Link
            className="opryn-secondary-action"
            href={`/app/knowledge/test?connectionId=${connection.id}`}
          >
            Test this connection
          </Link>
        </div>
      </fieldset>
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
