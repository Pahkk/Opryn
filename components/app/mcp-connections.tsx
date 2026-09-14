"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clipboard, LoaderCircle, Plug, Unplug } from "lucide-react";

type Grant = {
  id: string;
  clientKind: "chatgpt" | "claude" | "custom_mcp";
  clientName: string;
  userName: string;
  scopes: string[];
  lastUsedAt: string | null;
  authorizedAt: string;
};

const MCP_URL = "https://www.opryn.app/api/mcp";

export function McpConnections({
  grants,
  enabled,
}: {
  grants: Grant[];
  enabled: boolean;
}) {
  return (
    <section
      className="mb-10 border-y border-[var(--opryn-line)] bg-white"
      id="connect-mcp"
    >
      <div className="grid border-b border-[var(--opryn-line)] px-5 py-6 sm:grid-cols-[1fr_auto] sm:items-end sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--opryn-blue)]">
            Ask Opryn anywhere
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em] text-[var(--opryn-navy)]">
            ChatGPT, Claude, and remote MCP
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--opryn-muted)]">
            One secure connection to the same approved knowledge and permissions
            your team already uses.
          </p>
        </div>
        {!enabled ? (
          <Link
            href="/pricing"
            className="mt-4 inline-flex min-h-11 items-center justify-center bg-[var(--opryn-blue)] px-4 text-sm font-semibold text-white sm:mt-0"
          >
            Explore Premium
          </Link>
        ) : null}
      </div>
      <div className="divide-y divide-[var(--opryn-line)]">
        <ClientRow
          kind="chatgpt"
          title="ChatGPT"
          description="Ask Opryn from ChatGPT using your company's approved knowledge."
          grants={grants.filter((grant) => grant.clientKind === "chatgpt")}
          enabled={enabled}
        />
        <ClientRow
          kind="claude"
          title="Claude"
          description="Let Claude check approved Opryn knowledge for company-specific questions."
          grants={grants.filter((grant) => grant.clientKind === "claude")}
          enabled={enabled}
        />
        <ClientRow
          kind="custom_mcp"
          title="Custom MCP"
          description="Connect any compatible remote MCP client to Opryn."
          grants={grants.filter((grant) => grant.clientKind === "custom_mcp")}
          enabled={enabled}
        />
      </div>
    </section>
  );
}

function ClientRow({
  kind,
  title,
  description,
  grants,
  enabled,
}: {
  kind: Grant["clientKind"];
  title: string;
  description: string;
  grants: Grant[];
  enabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const active = grants.length > 0;
  return (
    <div className="px-5 py-5 sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-[var(--opryn-navy)]">
              {title}
            </h3>
            <span
              className={`text-xs font-semibold ${active ? "text-[#176f56]" : "text-[var(--opryn-faint)]"}`}
            >
              {active ? "Connected" : enabled ? "Not connected" : "Premium"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--opryn-muted)]">
            {description}
          </p>
          {active ? (
            <p className="mt-2 text-xs text-[var(--opryn-faint)]">
              {grants.length} authorized{" "}
              {grants.length === 1 ? "connection" : "connections"} ·{" "}
              {grants[0].lastUsedAt
                ? `Last used ${formatDate(grants[0].lastUsedAt)}`
                : "Not used yet"}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={!enabled}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--opryn-line)] px-4 text-sm font-semibold text-[var(--opryn-navy)] hover:border-[var(--opryn-blue)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Plug size={16} /> {active ? "Manage" : "Connect"}
        </button>
      </div>
      {expanded && enabled ? (
        <div className="mt-5 border-l-2 border-[var(--opryn-blue)] bg-[var(--opryn-blue-surface)] p-4 sm:p-5">
          <p className="text-sm font-semibold text-[var(--opryn-navy)]">
            {kind === "chatgpt"
              ? "Add Opryn in ChatGPT developer mode"
              : kind === "claude"
                ? "In Claude, open Customize → Connectors"
                : "Remote MCP setup"}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--opryn-muted)]">
            Use the server URL below. Your AI client opens Opryn sign-in, asks
            you to choose a business, and completes OAuth automatically.
          </p>
          <CopyValue value={MCP_URL} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={
                kind === "chatgpt"
                  ? "/docs/chatgpt"
                  : kind === "claude"
                    ? "/docs/claude"
                    : "/docs/mcp-development"
              }
              className="text-sm font-semibold text-[var(--opryn-blue)] hover:underline"
            >
              View setup guide
            </Link>
          </div>
          {grants.length ? (
            <div className="mt-5 divide-y divide-[#d9e4f6] border-y border-[#d9e4f6]">
              {grants.map((grant) => (
                <GrantRow key={grant.id} grant={grant} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GrantRow({ grant }: { grant: Grant }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!confirm(`Disconnect ${grant.clientName}?`)) return;
    setBusy(true);
    const response = await fetch(`/api/ai-connections/mcp/${grant.id}/revoke`, {
      method: "POST",
    });
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return (
    <div className="flex items-center gap-3 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--opryn-navy)]">
          {grant.clientName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--opryn-faint)]">
          Connected by {grant.userName} · {formatDate(grant.authorizedAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void disconnect()}
        disabled={busy}
        className="inline-flex min-h-10 items-center gap-2 px-2 text-xs font-semibold text-[#a4474e] hover:bg-white disabled:opacity-50"
      >
        {busy ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <Unplug size={14} />
        )}{" "}
        Disconnect
      </button>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  return (
    <div className="mt-4 flex items-center border border-[#cbd9ef] bg-white">
      <code className="min-w-0 flex-1 overflow-x-auto px-3 py-3 text-xs text-[var(--opryn-navy)]">
        {value}
      </code>
      <button
        type="button"
        aria-label="Copy MCP URL"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopyFailed(false);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setCopyFailed(true);
          }
        }}
        className="grid size-11 shrink-0 place-items-center border-l border-[#cbd9ef] text-[var(--opryn-blue)]"
      >
        {copied ? <Check size={16} /> : <Clipboard size={16} />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "MCP URL copied" : copyFailed ? "Could not copy MCP URL" : ""}
      </span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
