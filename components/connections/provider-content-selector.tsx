"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Database, FileText, Search, Waypoints } from "lucide-react";
import { StaggerList } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";

type Available = {
  externalId: string;
  title: string;
  sourceType: "page" | "database" | "space";
  parentContext: string | null;
  modifiedAt: string | null;
};
type Selected = {
  id: string;
  external_id: string;
  source_type: Available["sourceType"];
  title: string;
  parent_context: string | null;
  process_id: string | null;
  sync_status: "selected" | "imported" | "changed" | "unavailable" | "error";
  last_imported_at: string | null;
};

export function ProviderContentSelector({
  connectionId,
  provider,
  compact = false,
  onPrepared,
}: {
  connectionId: string;
  provider: "notion" | "confluence";
  compact?: boolean;
  onPrepared?: (processId: string) => void;
}) {
  const [available, setAvailable] = useState<Available[]>([]);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("loading");
  const [error, setError] = useState("");

  async function load(search = "") {
    setError("");
    const response = await fetch(
      `/api/integrations/nango/${connectionId}/content?q=${encodeURIComponent(search)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Provider content could not be loaded.");
    setAvailable(data.available ?? []);
    setSelected(data.selected ?? []);
  }
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/integrations/nango/${connectionId}/content?q=`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "Provider content could not be loaded.",
          );
        return data;
      })
      .then((data) => {
        if (!abort.signal.aborted) {
          setAvailable(data.available ?? []);
          setSelected(data.selected ?? []);
          setBusy("");
        }
      })
      .catch((caught) => {
        if (!abort.signal.aborted) {
          setBusy("");
          setError(caught.message);
        }
      });
    return () => abort.abort();
  }, [connectionId]);
  const selectedKeys = useMemo(
    () =>
      new Set(
        selected.map((item) => `${item.source_type}:${item.external_id}`),
      ),
    [selected],
  );

  async function saveSelection() {
    if (!checked.length) return;
    setBusy("select");
    setError("");
    try {
      const choices = available.filter((item) =>
        checked.includes(`${item.sourceType}:${item.externalId}`),
      );
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/content`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selections: choices.map((item) => ({
              externalId: item.externalId,
              sourceType: item.sourceType,
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Selection could not be saved.");
      setChecked([]);
      await load(query);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Selection could not be saved.",
      );
    } finally {
      setBusy("");
    }
  }
  async function importSource(source: Selected) {
    setBusy(source.id);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: source.id }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "This source could not be processed.");
      await load(query);
      if (data.busy)
        throw new Error(
          "This source is already being processed. Try again shortly.",
        );
      if (onPrepared) onPrepared(data.processId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This source could not be processed.",
      );
    } finally {
      setBusy("");
    }
  }
  async function remove(sourceId: string) {
    setBusy(sourceId);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/content`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "This source could not be removed.");
      await load(query);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "This source could not be removed.",
      );
    } finally {
      setBusy("");
    }
  }
  async function checkUpdates() {
    setBusy("check");
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/check`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Updates could not be checked.");
      await load(query);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Updates could not be checked.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <section
      className={`provider-content-selector ${compact ? "is-compact" : ""}`}
      aria-label={`Choose ${providerName(provider)} content`}
    >
      <div className="provider-content-heading">
        <div>
          <h4>
            {selected.length
              ? "Selected sources"
              : `Choose from ${providerName(provider)}`}
          </h4>
          <p>
            Imported information becomes a reviewable proposal. It is never
            approved automatically.
          </p>
        </div>
        {selected.some((item) => item.process_id) ? (
          <button
            className="opryn-button-secondary"
            disabled={Boolean(busy)}
            onClick={checkUpdates}
          >
            {busy === "check" ? "Checking…" : "Check for updates"}
          </button>
        ) : null}
      </div>
      {selected.length ? (
        <StaggerList
          changeKey={selected
            .map((item) => `${item.id}:${item.sync_status}`)
            .join("|")}
        >
          {selected.map((source) => (
            <div
              className="connection-file"
              key={source.id}
              data-motion-row={source.id}
            >
              <SourceIcon type={source.source_type} />
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.parent_context || labelType(source.source_type)} ·{" "}
                  {statusLabel(source.sync_status)}
                </small>
              </span>
              <span className="connection-file-actions">
                {source.process_id ? (
                  onPrepared ? (
                    <button onClick={() => onPrepared(source.process_id!)}>
                      Review
                    </button>
                  ) : (
                    <Link
                      href={`/app/processes/${source.process_id}?review=true`}
                    >
                      Review
                    </Link>
                  )
                ) : (
                  <button
                    disabled={Boolean(busy)}
                    onClick={() => importSource(source)}
                  >
                    {busy === source.id ? "Preparing…" : "Learn"}
                  </button>
                )}
                <button
                  disabled={Boolean(busy)}
                  onClick={() => remove(source.id)}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </StaggerList>
      ) : null}
      <form
        className="provider-source-search"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query).catch((caught) => setError(caught.message));
        }}
      >
        <Search size={16} aria-hidden />
        <label className="sr-only" htmlFor={`provider-source-${connectionId}`}>
          Search {providerName(provider)}
        </label>
        <input
          id={`provider-source-${connectionId}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${providerName(provider)} pages${provider === "notion" ? " and databases" : " and spaces"}`}
        />
        <button type="submit" disabled={Boolean(busy)}>
          Search
        </button>
      </form>
      <div className="provider-source-results">
        {busy === "loading" ? (
          <p
            className="px-2 py-5 text-sm text-[var(--opryn-muted)]"
            role="status"
          >
            Loading available content…
          </p>
        ) : null}
        {busy !== "loading" && !available.length ? (
          <div className="px-2 py-6">
            <p className="text-sm font-semibold text-[var(--opryn-navy)]">
              No accessible content found.
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--opryn-muted)]">
              {provider === "notion"
                ? "Share a page with the Opryn Notion integration, then search again."
                : "Check that this account can view the intended Confluence pages or spaces."}
            </p>
          </div>
        ) : null}
        {available.map((source) => {
          const key = `${source.sourceType}:${source.externalId}`;
          const saved = selectedKeys.has(key);
          return (
            <label key={key} className="provider-source-row">
              <input
                type="checkbox"
                disabled={saved || Boolean(busy)}
                checked={saved || checked.includes(key)}
                onChange={() =>
                  setChecked((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  )
                }
              />
              <SourceIcon type={source.sourceType} />
              <span>
                <strong>{source.title}</strong>
                <small>
                  {source.parentContext || labelType(source.sourceType)}
                  {source.modifiedAt
                    ? ` · Updated ${new Date(source.modifiedAt).toLocaleDateString()}`
                    : ""}
                </small>
              </span>
              {saved ? <Check size={16} aria-label="Selected" /> : null}
            </label>
          );
        })}
      </div>
      {checked.length ? (
        <button
          className="opryn-action"
          disabled={Boolean(busy)}
          onClick={saveSelection}
        >
          {busy === "select"
            ? "Saving…"
            : `Learn from ${checked.length} selected`}
        </button>
      ) : null}
      {error ? (
        <p className="connection-error" role="alert">
          {error}
        </p>
      ) : null}
      {busy && !["loading", "select", "check"].includes(busy) ? (
        <div className="teach-ai-processing" role="status" aria-live="polite">
          <OprynThinkingOrb
            state="solving"
            size={64}
            label="Opryn is structuring this source"
            decorative
          />
          <span>
            <strong>Structuring what matters…</strong>
            <small>
              Preparing a reviewable finding. Nothing is approved automatically.
            </small>
          </span>
        </div>
      ) : null}
    </section>
  );
}

function SourceIcon({ type }: { type: Available["sourceType"] }) {
  return type === "database" ? (
    <Database size={18} aria-hidden />
  ) : type === "space" ? (
    <Waypoints size={18} aria-hidden />
  ) : (
    <FileText size={18} aria-hidden />
  );
}
function providerName(provider: "notion" | "confluence") {
  return provider === "notion" ? "Notion" : "Confluence";
}
function labelType(type: Available["sourceType"]) {
  return type[0].toUpperCase() + type.slice(1);
}
function statusLabel(status: Selected["sync_status"]) {
  return status === "imported"
    ? "Up to date"
    : status === "selected"
      ? "Ready to learn"
      : status === "changed"
        ? "Source changed"
        : status === "unavailable"
          ? "Permission lost"
          : "Needs attention";
}
