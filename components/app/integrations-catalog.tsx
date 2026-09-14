"use client";
import { MotionRegion } from "@/components/motion/motion-region";
import "@/components/connections/connections.css";
import { NangoConnection } from "@/components/connections/nango-connection";
import { DialogSurface } from "@/components/app/dialog-surface";
import { WorkspaceNotice } from "@/components/app/workspace-context";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronRight, Plus, Search, X } from "lucide-react";
import {
  CredentialConnectionButton,
  DisconnectCredentialConnection,
} from "@/components/connections/credential-connection";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { RequestIntegration } from "@/components/connections/request-integration";
import type { IntegrationCatalogItem } from "@/lib/integrations/types";
import { isIntegrationReady } from "@/lib/integrations/catalog";

export type IntegrationConnectionView = {
  providerId: string;
  connected: boolean;
  id?: string;
  detail?: string;
  lastUsed?: string | null;
  authorizationOnly?: boolean;
  setupOnly?: boolean;
  needsAttention?: boolean;
  nango?: boolean;
};

type FilterId =
  | "all"
  | "teach"
  | "use"
  | "learn"
  | "communication"
  | "ai"
  | "calls"
  | "business"
  | "connected";

const filters: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "teach", label: "Teach Opryn" },
  { id: "use", label: "Use Opryn" },
  { id: "connected", label: "Connected" },
];
function teaches(provider: IntegrationCatalogItem) {
  return provider.capabilities.some((capability) =>
    ["knowledge_import", "call_learning", "processes_create"].includes(
      capability,
    ),
  );
}
function uses(provider: IntegrationCatalogItem) {
  return provider.capabilities.some((capability) =>
    [
      "ask_opryn",
      "ai_knowledge_access",
      "escalation_notifications",
      "customer_context",
    ].includes(capability),
  );
}
function directionLabel(provider: IntegrationCatalogItem) {
  if (teaches(provider) && uses(provider)) return "Teach & use Opryn";
  if (teaches(provider)) return "Knowledge source";
  return provider.category === "communication"
    ? "Team access"
    : provider.category === "business"
      ? "Business context"
      : "AI access";
}

const categoryLabels: Record<IntegrationCatalogItem["category"], string> = {
  learn: "Knowledge",
  communication: "Communication",
  ai: "AI",
  calls: "Calls",
  business: "Business",
};

export function IntegrationsCatalog({
  providers,
  connections,
  plan,
  autoFocus = false,
  initialFilter = "all",
  initialProviderId,
  nangoProviders = [],
  organizationId,
  organizationName = "your business",
  returnTo = "/app/integrations",
}: {
  providers: IntegrationCatalogItem[];
  connections: IntegrationConnectionView[];
  recommendedIds: string[];
  plan: "core" | "premium";
  autoFocus?: boolean;
  initialFilter?: FilterId;
  initialProviderId?: string;
  nangoProviders?: string[];
  organizationId?: string;
  organizationName?: string;
  returnTo?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>(initialFilter);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialProviderId ?? null,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, setPending] = useState<{ id: string; provider: string }[]>(
    [],
  );
  const nangoEnabled = nangoProviders.length > 0;
  useEffect(() => {
    if (!nangoEnabled) return;
    const abort = new AbortController();
    fetch("/api/integrations/nango/session", { signal: abort.signal })
      .then(async (response) =>
        response.ok ? response.json() : { attempts: [] },
      )
      .then((data) => setPending(data.attempts ?? []))
      .catch(() => {});
    return () => abort.abort();
  }, [nangoEnabled, organizationId, selectedId]);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusByProvider = useMemo(
    () =>
      new Map(
        connections.map((connection) => [connection.providerId, connection]),
      ),
    [connections],
  );
  const visibleProviders = useMemo(
    () =>
      providers.filter(
        (provider) =>
          isIntegrationReady(provider) ||
          ["notion", "sharepoint", "confluence", "hubspot"].includes(
            provider.id,
          ) ||
          Boolean(statusByProvider.get(provider.id)?.id),
      ),
    [providers, statusByProvider],
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const results = useMemo(() => {
    const normalizedQuery = normalize(query);
    return visibleProviders
      .filter((provider) => {
        const connection = statusByProvider.get(provider.id);
        if (filter === "connected") return connection?.connected;
        if (filter === "teach") return teaches(provider);
        if (filter === "use") return uses(provider);
        return filter === "all" || provider.category === filter;
      })
      .map((provider) => ({
        provider,
        score: normalizedQuery ? searchScore(provider, normalizedQuery) : 1,
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.provider.name.localeCompare(right.provider.name),
      )
      .map((item) => item.provider);
  }, [filter, visibleProviders, query, statusByProvider]);

  const selected = visibleProviders.find(
    (provider) => provider.id === selectedId,
  );

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!query || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      setSelectedId(results[activeIndex]?.id ?? null);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  return (
    <div className="integrations-page space-y-9" data-guide="connections.ai">
      <header className="home-reveal max-w-3xl pt-2">
        <h1 className="opryn-page-title">Connections</h1>
        <p className="mt-3 text-[15px] leading-7 text-[var(--opryn-muted)]">
          Bring knowledge into Opryn and use Opryn everywhere your company
          works.
        </p>
      </header>

      <section className="home-reveal relative z-20">
        <label htmlFor="integration-search" className="sr-only">
          Search integrations
        </label>
        <div className="integration-search-shell flex min-h-16 items-center rounded-[20px] border border-[#cfdaea] bg-white px-5 shadow-[0_12px_38px_rgba(7,27,61,.06)] focus-within:border-[var(--opryn-blue)] focus-within:shadow-[0_14px_40px_rgba(20,107,255,.1)]">
          <Search
            className="size-5 shrink-0 text-[var(--opryn-blue)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id="integration-search"
            data-guide="connections.search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search integrations"
            className="min-w-0 flex-1 bg-transparent px-4 py-5 text-base text-[var(--opryn-navy)] outline-none placeholder:text-[#929eaf]"
            role="combobox"
            aria-expanded={Boolean(query)}
            aria-controls="integration-results"
            aria-activedescendant={
              query && results[activeIndex]
                ? `integration-${results[activeIndex].id}`
                : undefined
            }
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
              aria-label="Clear integration search"
            >
              <X size={17} />
            </button>
          ) : (
            <kbd className="hidden rounded-[7px] border border-[var(--opryn-line)] bg-[#f7f9fc] px-2 py-1 text-[10px] font-semibold text-[var(--opryn-faint)] sm:block">
              Search
            </kbd>
          )}
        </div>

        {query ? (
          <div
            id="integration-results"
            className="integration-search-results absolute left-0 right-0 top-[calc(100%+8px)] max-h-[440px] overflow-y-auto rounded-[20px] border border-[var(--opryn-line)] bg-white p-2 shadow-[0_24px_70px_rgba(7,27,61,.14)]"
            role="listbox"
            aria-live="polite"
          >
            {results.length ? (
              results.map((provider, index) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  connection={statusByProvider.get(provider.id)}
                  active={index === activeIndex}
                  compact
                  onOpen={() => setSelectedId(provider.id)}
                />
              ))
            ) : (
              <div className="px-5 py-7 sm:px-7">
                <h2 className="text-lg font-semibold text-[var(--opryn-navy)]">
                  No integration found.
                </h2>
                <p className="mt-1 text-sm text-[var(--opryn-muted)]">
                  We don&apos;t support that connection yet.
                </p>
                <div className="mt-4">
                  <RequestIntegration defaultProviderName={query} />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {pending.length ? (
        <section aria-label="Pending authorizations">
          <h2 className="text-lg font-semibold">Authorization in progress</h2>
          {pending.map((attempt) => (
            <button
              key={attempt.id}
              className="opryn-button-secondary mt-3"
              onClick={() => setSelectedId(attempt.provider)}
            >
              Continue{" "}
              {providers.find((provider) => provider.id === attempt.provider)
                ?.name ?? "connection"}
            </button>
          ))}
        </section>
      ) : null}

      <section
        id="all-integrations"
        className="home-reveal scroll-mt-24"
        hidden={Boolean(query)}
      >
        <div className="flex flex-col gap-4 border-b border-[var(--opryn-line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="opryn-section-label">BROWSE</p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
              All integrations
            </h2>
          </div>
          <div
            className="flex max-w-full gap-1 overflow-x-auto pb-1"
            aria-label="Filter integrations"
          >
            {filters
              .filter(
                (item) =>
                  item.id === "all" ||
                  item.id === "teach" ||
                  item.id === "use" ||
                  item.id === "connected" ||
                  visibleProviders.some(
                    (provider) => provider.category === item.id,
                  ),
              )
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setFilter(item.id);
                    setActiveIndex(0);
                  }}
                  className={`min-h-10 whitespace-nowrap rounded-[10px] px-3 text-xs font-semibold transition-colors ${filter === item.id ? "bg-[#e8f2ff] text-[var(--opryn-blue)]" : "text-[var(--opryn-muted)] hover:bg-white hover:text-[var(--opryn-navy)]"}`}
                  aria-pressed={filter === item.id}
                >
                  {item.label}
                </button>
              ))}
          </div>
        </div>
        {results.length ? (
          [
            {
              id: "teach",
              title: "Teach Opryn",
              description:
                "Knowledge sources. Imported information is prepared for review.",
            },
            {
              id: "use",
              title: "Use Opryn",
              description:
                "Give your people and connected AI access to approved knowledge.",
            },
          ].map((group) => {
            const groupProviders = results.filter(
              (provider) =>
                (filter === "teach" ||
                  (teaches(provider) && !uses(provider))) ===
                (group.id === "teach"),
            );
            return groupProviders.length ? (
              <section key={group.id} className="mt-8" aria-label={group.title}>
                <h3 className="text-lg font-semibold">{group.title}</h3>
                <p className="mt-2 mb-4 text-sm text-[var(--opryn-muted)]">
                  {group.description}
                </p>
                <div className="divide-y divide-[var(--opryn-line)]">
                  {groupProviders.map((provider) => (
                    <ProviderRow
                      key={provider.id}
                      provider={provider}
                      connection={statusByProvider.get(provider.id)}
                      onOpen={() => setSelectedId(provider.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null;
          })
        ) : (
          <p className="py-8">No connections match this filter.</p>
        )}
      </section>

      <section className="home-reveal flex flex-col gap-5 rounded-[22px] border border-[var(--opryn-line)] bg-[#f6f9fd] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 className="text-lg font-semibold text-[var(--opryn-navy)]">
            Can&apos;t find your software?
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--opryn-muted)]">
            Tell us what you use and what you need Opryn to do with it.
          </p>
        </div>
        <RequestIntegration />
      </section>

      {selected ? (
        organizationId &&
        (nangoProviders.includes(selected.id) ||
          statusByProvider.get(selected.id)?.nango) ? (
          <NangoConnection
            key={selected.id}
            provider={selected}
            organizationId={organizationId}
            organizationName={organizationName}
            returnTo={returnTo}
            pendingAttemptId={
              pending.find((attempt) => attempt.provider === selected.id)?.id
            }
            connectionId={
              statusByProvider.get(selected.id)?.nango
                ? statusByProvider.get(selected.id)?.id
                : undefined
            }
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <IntegrationDrawer
            provider={selected}
            connection={statusByProvider.get(selected.id)}
            plan={plan}
            onClose={() => setSelectedId(null)}
          />
        )
      ) : null}
    </div>
  );
}

function ProviderRow({
  provider,
  connection,
  onOpen,
  active = false,
  compact = false,
}: {
  provider: IntegrationCatalogItem;
  connection?: IntegrationConnectionView;
  onOpen: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  if (compact)
    return (
      <button
        id={`integration-${provider.id}`}
        data-guide={
          provider.id === "google_drive" ? "connections.google" : undefined
        }
        type="button"
        role="option"
        aria-selected={active}
        aria-label={`${connection?.connected || connection?.setupOnly ? "Manage" : !isIntegrationReady(provider) ? "Request" : "Connect"} ${provider.name}`}
        onClick={onOpen}
        className={`integration-provider-row flex min-h-20 w-full items-center gap-3 rounded-2xl px-3 py-4 text-left ${active ? "bg-[#f1f6ff]" : "hover:bg-[#f8faff]"}`}
      >
        <ProviderLogo id={provider.id} name={provider.name} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--opryn-navy)]">
            {provider.name}
          </span>
          <span className="mt-1 block text-xs text-[var(--opryn-muted)]">
            {directionLabel(provider)} ·{" "}
            {connection?.setupOnly
              ? "Setup saved · Not verified"
              : connection?.connected
                ? connection.authorizationOnly
                  ? "Authorized"
                  : "Connected"
                : !isIntegrationReady(provider)
                  ? "Request integration"
                  : provider.description}
          </span>
        </span>
        {connection?.setupOnly ? (
          <span className="text-xs text-[var(--opryn-muted)]">Manage</span>
        ) : connection?.connected ? (
          <Check
            className="size-5 shrink-0 text-[var(--opryn-blue)]"
            aria-hidden
          />
        ) : (
          <Plus
            className="size-5 shrink-0 text-[var(--opryn-blue)]"
            aria-hidden
          />
        )}
      </button>
    );
  return (
    <div
      role={compact ? "option" : undefined}
      aria-selected={compact ? active : undefined}
      className={`integration-provider-row group flex items-center gap-4 rounded-[16px] px-4 ${compact ? "py-3" : "py-5 sm:px-5"} ${active ? "bg-[#f1f6ff]" : "hover:bg-[#f8faff]"}`}
    >
      <ProviderLogo id={provider.id} name={provider.name} />
      <button
        type="button"
        onClick={onOpen}
        data-guide={
          provider.id === "google_drive" ? "connections.google" : undefined
        }
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[var(--opryn-navy)]">
            {provider.name}
          </h3>
          <span className="text-[11px] font-medium text-[var(--opryn-faint)]">
            {directionLabel(provider)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-[var(--opryn-muted)]">
          {connection?.setupOnly
            ? "Saved details only. Workflow not verified."
            : connection?.needsAttention
              ? "Needs attention. Open Manage to restore access."
              : connection?.connected
                ? connection.authorizationOnly
                  ? "Authorized · Test a question to verify access."
                  : "Connected · " + (connection.detail ?? provider.description)
                : !isIntegrationReady(provider)
                  ? "Not available yet. Tell us how you would use it."
                  : provider.description}
        </p>
      </button>
      {connection?.setupOnly ? (
        <button
          type="button"
          onClick={onOpen}
          className="opryn-button-secondary px-3 text-xs"
          aria-label={`Manage ${provider.name}`}
        >
          Setup saved
        </button>
      ) : connection?.connected ? (
        <MotionRegion variant="status">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] bg-[#edf4ff] px-3 text-xs font-semibold text-[var(--opryn-blue)]"
            aria-label={`Manage ${provider.name}`}
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Manage</span>
          </button>
        </MotionRegion>
      ) : connection?.needsAttention ? (
        <button
          type="button"
          onClick={onOpen}
          className="min-h-10 shrink-0 rounded-[10px] bg-[var(--opryn-coral-surface)] px-3 text-xs font-semibold text-[var(--opryn-coral)]"
        >
          Reconnect
        </button>
      ) : !isIntegrationReady(provider) ? (
        <button
          type="button"
          onClick={onOpen}
          className="text-sm text-[var(--opryn-muted)]"
          aria-label={`Request ${provider.name}`}
        >
          Request
        </button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="opryn-button-secondary min-h-11 shrink-0 px-3 text-sm"
          aria-label={`Connect ${provider.name}`}
          title={`Connect ${provider.name}`}
        >
          <span>Connect</span>
        </button>
      )}
    </div>
  );
}

function IntegrationDrawer({
  provider,
  connection,
  plan,
  onClose,
}: {
  provider: IntegrationCatalogItem;
  connection?: IntegrationConnectionView;
  plan: "core" | "premium";
  onClose: () => void;
}) {
  const locked = provider.premium && plan !== "premium";
  const isCredentialGuide = provider.authMode === "credential_guide";
  const href = locked ? "/pricing" : provider.href;

  function primaryAction() {
    if (!isIntegrationReady(provider) && !connection?.id)
      return <RequestIntegration defaultProviderName={provider.name} />;
    if (connection?.setupOnly && connection.id)
      return (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--opryn-muted)]">
            Saved setup details do not mean this provider can import or answer
            questions yet. Existing Opryn knowledge is unchanged.
          </p>
          <DisconnectCredentialConnection
            integrationId={connection.id}
            providerName={provider.name}
          />
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              Developer Setup
            </summary>
            <CredentialConnectionButton
              provider={provider}
              connected
              label="Manage saved details"
            />
          </details>
        </div>
      );
    if (isCredentialGuide && !locked)
      return (
        <div className="flex flex-wrap items-center gap-3">
          <CredentialConnectionButton
            provider={provider}
            connected={connection?.connected}
            label={
              connection?.connected
                ? "Manage Setup"
                : `Connect ${provider.name}`
            }
            className="!border-[var(--opryn-blue)] !bg-[var(--opryn-blue)] !text-white"
          />
          {connection?.connected && connection.id ? (
            <DisconnectCredentialConnection
              integrationId={connection.id}
              providerName={provider.name}
            />
          ) : null}
        </div>
      );
    if (!href) return null;
    return (
      <Link href={href} className="opryn-action">
        {connection?.connected
          ? "Manage"
          : locked
            ? "Explore Premium"
            : provider.id === "google_drive" || provider.id === "google_docs"
              ? "Import a document"
              : provider.authMode === "mcp"
                ? "Set Up"
                : connection?.needsAttention
                  ? "Reconnect"
                  : `Connect ${provider.name}`}
        <ArrowRight className="size-4" />
      </Link>
    );
  }

  return (
    <DialogSurface
      onClose={onClose}
      labelledBy="integration-drawer-title"
      className="dialog-review"
    >
      <aside
        className="integration-drawer dialog-content h-full w-full overflow-y-auto bg-white shadow-[var(--opryn-shadow-lg)] sm:max-w-[520px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--opryn-line)] bg-white px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <ProviderLogo id={provider.id} name={provider.name} />
            <div>
              <h2
                id="integration-drawer-title"
                className="font-semibold text-[var(--opryn-navy)]"
              >
                {provider.name}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--opryn-muted)]">
                {categoryLabels[provider.category]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-[11px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
            aria-label="Close integration details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <div>
            <p className="text-lg font-semibold leading-7 text-[var(--opryn-navy)]">
              {!isIntegrationReady(provider) && !connection?.id
                ? "Request this integration"
                : connection?.setupOnly
                  ? "Setup details saved. A working Opryn connection has not been verified."
                  : provider.description}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-semibold ${connection?.connected ? "text-[var(--opryn-blue)]" : connection?.needsAttention ? "text-[var(--opryn-coral)]" : "text-[var(--opryn-muted)]"}`}
              >
                {connection?.setupOnly
                  ? "Setup saved · Not verified"
                  : connection?.connected
                    ? connection.authorizationOnly
                      ? "Authorized"
                      : "Connected"
                    : connection?.needsAttention
                      ? "Needs attention"
                      : "Not connected"}
              </span>
              <span className="text-[var(--opryn-faint)]">·</span>
              <span className="text-[var(--opryn-muted)]">
                {connection?.detail ?? provider.setupTime}
              </span>
            </div>
          </div>

          <div className="border-t border-[var(--opryn-line)] pt-5 sm:hidden">
            {primaryAction()}
            {locked ? (
              <p className="mt-3 text-xs text-[var(--opryn-muted)]">
                Available with Opryn Premium.
              </p>
            ) : null}
          </div>

          <section>
            <WorkspaceNotice action="Connecting to" />
            <h3 className="text-sm font-semibold text-[var(--opryn-navy)]">
              What this does
            </h3>
            <ul className="mt-3 space-y-3">
              {(connection?.setupOnly
                ? ["Manage or remove the setup details you saved"]
                : provider.permissions.can
              ).map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-sm leading-6 text-[var(--opryn-muted)]"
                >
                  <Check className="mt-1 size-4 shrink-0 text-[var(--opryn-blue)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="border-l-2 border-[#b9d3f8] bg-[#f3f7fd] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--opryn-navy)]">
              Your information stays controlled
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--opryn-muted)]">
              {provider.permissions.privacy}
            </p>
          </section>

          {connection?.needsAttention ? (
            <p className="rounded-[12px] bg-[var(--opryn-coral-surface)] p-4 text-sm font-medium text-[var(--opryn-coral)]">
              This connection needs to be authorized again.
            </p>
          ) : null}

          <div className="hidden border-t border-[var(--opryn-line)] pt-6 sm:block">
            {primaryAction()}
            {locked ? (
              <p className="mt-3 text-xs text-[var(--opryn-muted)]">
                Available with Opryn Premium.
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--opryn-muted)] hover:text-[var(--opryn-navy)]"
          >
            Back to connections <ChevronRight className="size-3 rotate-180" />
          </button>
        </div>
      </aside>
    </DialogSurface>
  );
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function searchScore(provider: IntegrationCatalogItem, query: string) {
  const name = normalize(provider.name);
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 65;
  const aliases = provider.aliases?.map(normalize) ?? [];
  if (aliases.some((alias) => alias === query || alias.startsWith(query)))
    return 55;
  const category = categoryLabels[provider.category].toLowerCase();
  const haystack = [
    category,
    provider.description,
    ...provider.capabilities,
    ...aliases,
  ]
    .join(" ")
    .toLowerCase();
  if (haystack.includes(query)) return 35;
  // Fuzzy matching descriptions made unrelated tools match almost any query.
  return isSubsequence(query, name) ||
    aliases.some((alias) => isSubsequence(query, alias))
    ? 10
    : 0;
}

function isSubsequence(needle: string, haystack: string) {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
    if (index === needle.length) return true;
  }
  return false;
}
