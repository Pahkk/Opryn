"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "slack" | "teams";

export function CommunicationIntegration({
  provider,
  connected,
  workspaceName,
  status,
  mappedUsers,
  totalMembers,
  accessMode,
  justConnected,
  error,
  roles,
  members,
  selectedRoleIds,
  selectedUserIds,
}: {
  provider: Provider;
  connected: boolean;
  workspaceName: string | null;
  status: "active" | "paused" | "disconnected" | null;
  mappedUsers: number;
  totalMembers: number;
  accessMode: "all_members" | "selected_roles" | "selected_users";
  justConnected?: boolean;
  error?: string;
  roles: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  selectedRoleIds: string[];
  selectedUserIds: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(
    justConnected ? `${label(provider)} is connected to Opryn.` : "",
  );
  const [mode, setMode] = useState(accessMode);
  const [active, setActive] = useState(status !== "paused");
  const [roleIds, setRoleIds] = useState(selectedRoleIds);
  const [userIds, setUserIds] = useState(selectedUserIds);

  async function update(next: {
    status?: "active" | "paused";
    accessMode?: typeof mode;
    roleIds?: string[];
    userIds?: string[];
  }) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/integrations/communication", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...next }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setSaving(false);
    if (!response.ok)
      return setMessage(body.error || "Opryn couldn't save this setting.");
    if (next.status) setActive(next.status === "active");
    if (next.accessMode) setMode(next.accessMode);
    setMessage("Saved.");
    router.refresh();
  }

  async function disconnect() {
    if (
      !window.confirm(
        `Disconnect ${label(provider)} from this Opryn workspace?`,
      )
    )
      return;
    setSaving(true);
    const response = await fetch(
      `/api/integrations/communication?provider=${provider}`,
      { method: "DELETE" },
    );
    setSaving(false);
    if (!response.ok)
      return setMessage("Opryn couldn't disconnect this integration.");
    router.refresh();
  }

  if (!connected)
    return (
      <section className="opryn-surface overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <p className="opryn-section-label">Opryn Everywhere</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-.035em] text-[var(--opryn-navy)]">
              Ask Opryn without changing tabs.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--opryn-muted)]">
              Team members get the same approved answers, sources, and expert
              routing they use in Opryn Web. Opryn does not read unrelated
              conversations.
            </p>
            {error ? (
              <p
                role="alert"
                className="mt-4 text-sm font-medium text-[var(--opryn-coral)]"
              >
                {error === "not_configured"
                  ? `${label(provider)} setup is not finished for Opryn yet. Add the provider credentials, then try again.`
                  : "The connection wasn’t completed. Please try again."}
              </p>
            ) : null}
            <a
              href={`/api/integrations/${provider}/connect`}
              className="opryn-action mt-6"
            >
              Continue to {provider === "slack" ? "Slack" : "Microsoft"}
            </a>
            <p className="mt-3 text-xs leading-5 text-[var(--opryn-faint)]">
              You&apos;ll authorize Opryn in {label(provider)} and return here
              automatically. No command line or token copying.
            </p>
          </div>
          <ChannelFlow provider={provider} />
        </div>
      </section>
    );

  return (
    <div className="space-y-6">
      {message ? (
        <p
          aria-live="polite"
          className="rounded-[10px] border border-[#bfd2f5] bg-[var(--opryn-blue-surface)] px-4 py-3 text-sm text-[var(--opryn-navy)]"
        >
          {message}
        </p>
      ) : null}
      <section className="opryn-surface overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-[var(--opryn-border)] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
                {workspaceName}
              </h2>
              <span
                className={`text-xs font-semibold ${active ? "text-[var(--opryn-blue)]" : "text-[var(--opryn-muted)]"}`}
              >
                {active ? "Connected" : "Paused"}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--opryn-muted)]">
              {mappedUsers} of {totalMembers} team members linked
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => update({ status: active ? "paused" : "active" })}
            className="opryn-secondary-action w-fit"
          >
            {active ? "Pause" : "Resume"}
          </button>
        </div>
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="p-6 sm:p-7">
            <p className="opryn-section-label">What your team can do</p>
            <div className="mt-5 divide-y divide-[var(--opryn-border)] text-sm text-[var(--opryn-ink)]">
              {[
                "Ask from a direct chat",
                "Mention Opryn in a conversation",
                "Open the exact source",
                "Send unknowns to an expert",
                "Report an answer that is not right",
              ].map((item) => (
                <p key={item} className="py-3 first:pt-0">
                  {item}
                </p>
              ))}
            </div>
          </div>
          <div className="border-t border-[var(--opryn-border)] bg-[var(--opryn-blue-surface)] p-6 sm:p-7 lg:border-l lg:border-t-0">
            <label className="block text-sm font-semibold text-[var(--opryn-navy)]">
              Who can use Opryn here?
              <select
                value={mode}
                disabled={saving}
                onChange={(event) =>
                  update({ accessMode: event.target.value as typeof mode })
                }
                className="mt-3 min-h-11 w-full rounded-[8px] border border-[var(--opryn-line-strong)] bg-white px-3 text-sm font-medium"
              >
                <option value="all_members">All linked team members</option>
                <option value="selected_roles">Selected roles</option>
                <option value="selected_users">Selected people</option>
              </select>
            </label>
            <p className="mt-3 text-xs leading-5 text-[var(--opryn-muted)]">
              Opryn still applies each person&apos;s role and knowledge
              permissions to every answer.
            </p>
            {mode !== "all_members" ? (
              <div className="mt-4 border-t border-[#d8e3f4] pt-4">
                <p className="text-xs font-semibold text-[var(--opryn-navy)]">
                  Choose {mode === "selected_roles" ? "roles" : "people"}
                </p>
                <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                  {(mode === "selected_roles" ? roles : members).map((item) => {
                    const selected =
                      mode === "selected_roles" ? roleIds : userIds;
                    return (
                      <label
                        key={item.id}
                        className="flex min-h-9 items-center gap-2 text-xs text-[var(--opryn-ink)]"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          disabled={saving}
                          onChange={() => {
                            const next = selected.includes(item.id)
                              ? selected.filter((id) => id !== item.id)
                              : [...selected, item.id];
                            if (mode === "selected_roles") {
                              setRoleIds(next);
                              void update({ roleIds: next });
                            } else {
                              setUserIds(next);
                              void update({ userIds: next });
                            }
                          }}
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <section className="border-t border-[var(--opryn-border)] pt-6">
        <h3 className="text-sm font-semibold text-[var(--opryn-navy)]">
          Disconnect
        </h3>
        <p className="mt-1 text-sm text-[var(--opryn-muted)]">
          This stops new messages immediately. Existing Opryn knowledge stays
          intact.
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={disconnect}
          className="mt-4 min-h-10 rounded-[8px] border border-[#e4bfc3] px-4 text-sm font-semibold text-[#9b3540] hover:bg-[#fff5f5]"
        >
          Disconnect {label(provider)}
        </button>
      </section>
    </div>
  );
}

function ChannelFlow({ provider }: { provider: Provider }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-[var(--opryn-navy)] p-5 text-white">
      <p className="text-[11px] font-semibold tracking-[.08em] text-[#9db9e8]">
        A QUESTION MOVES ONCE
      </p>
      <p className="mt-5 text-sm text-[#dce7f8]">{label(provider)} message</p>
      <span className="my-3 block h-5 w-px bg-[#4a78bd]" />
      <p className="text-sm font-semibold">Approved Opryn knowledge</p>
      <span className="my-3 block h-5 w-px bg-[#4a78bd]" />
      <p className="text-sm text-[#dce7f8]">Answer + exact source</p>
    </div>
  );
}

function label(provider: Provider) {
  return provider === "slack" ? "Slack" : "Microsoft Teams";
}
