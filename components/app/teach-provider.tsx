"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { NangoConnection } from "@/components/connections/nango-connection";
import { ProviderContentSelector } from "@/components/connections/provider-content-selector";
import { TeachWorkflow } from "@/components/motion/teach-workflow";
import { getIntegrationCatalogItem } from "@/lib/integrations/catalog";

export function TeachProvider({
  provider,
  organizationId,
  organizationName,
  onPrepared,
  initialConnectionId,
}: {
  provider: "notion" | "confluence";
  organizationId: string;
  organizationName: string;
  onPrepared?: (processId: string) => void;
  initialConnectionId?: string | null;
}) {
  const catalog = getIntegrationCatalogItem(provider)!;
  const [connectionId, setConnectionId] = useState<string | null>(
    initialConnectionId || null,
  );
  const [sheet, setSheet] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [attempt, setAttempt] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const key = `opryn:teach-${provider}:${organizationId}`;
  const connected = useCallback(
    (id: string) => {
      sessionStorage.removeItem(key);
      setConnectionId(id);
      setSheet(false);
      setSelectorOpen(true);
    },
    [key],
  );

  async function discover(signal?: AbortSignal) {
    const response = await fetch(
      `/api/integrations/capability?provider=${provider}&capability=knowledge_import`,
      { cache: "no-store", signal },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || `${catalog.name} is unavailable.`);
    if (data.connectionId) connected(data.connectionId);
    else setSheet(true);
  }
  useEffect(() => {
    if (sessionStorage.getItem(key) !== location.pathname + location.search)
      return;
    const abort = new AbortController();
    void Promise.all([
      fetch(
        `/api/integrations/capability?provider=${provider}&capability=knowledge_import`,
        { cache: "no-store", signal: abort.signal },
      ).then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || `${catalog.name} is unavailable.`);
        return data;
      }),
      fetch("/api/integrations/nango/session", {
        cache: "no-store",
        signal: abort.signal,
      }).then((response) => response.json()),
    ])
      .then(([capability, sessions]) => {
        if (abort.signal.aborted) return;
        if (capability.connectionId) connected(capability.connectionId);
        else setSheet(true);
        setAttempt(
          sessions.attempts?.find(
            (item: { provider: string }) => item.provider === provider,
          )?.id,
        );
      })
      .catch(() => setError(`Resume ${catalog.name} by choosing it again.`));
    return () => abort.abort();
  }, [catalog.name, connected, key, provider]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem(key, location.pathname + location.search);
      await discover();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `${catalog.name} could not open.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="teach-provider-action">
      <button
        ref={trigger}
        type="button"
        className="teach-source-action"
        disabled={busy}
        onClick={() => (connectionId ? setSelectorOpen(true) : void start())}
      >
        {busy
          ? `Checking ${catalog.name}…`
          : `Choose ${provider === "notion" ? "pages or databases" : "pages or spaces"}`}{" "}
        <span aria-hidden>→</span>
      </button>
      {error ? (
        <p role="alert" className="connection-error">
          {error}
        </p>
      ) : null}
      {sheet ? (
        <NangoConnection
          provider={catalog}
          organizationId={organizationId}
          organizationName={organizationName}
          pendingAttemptId={attempt}
          onConnected={connected}
          onClose={() => {
            setSheet(false);
            sessionStorage.removeItem(key);
          }}
        />
      ) : null}
      <TeachWorkflow open={!!connectionId && selectorOpen}>
        <section aria-label={`Choose ${catalog.name} content`}>
          <header>
            <div>
              <p>TEACH OPRYN</p>
              <h2>Your {catalog.name} sources</h2>
            </div>
            <button
              onClick={() => {
                setSelectorOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }}
            >
              Close
            </button>
          </header>
          <ProviderContentSelector
            connectionId={connectionId!}
            provider={provider}
            compact
            onPrepared={onPrepared}
          />
        </section>
      </TeachWorkflow>
    </div>
  );
}
