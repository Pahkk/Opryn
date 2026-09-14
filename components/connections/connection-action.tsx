"use client";
import "./connections.css";
import { useCallback, useEffect, useState } from "react";
import { NangoConnection } from "./nango-connection";
import { GoogleWorkspacePicker } from "./google-workspace-picker";
import { getIntegrationCatalogItem } from "@/lib/integrations/catalog";

/** A scoped capability, not an integration-management navigation link. */
export function ConnectionAction({
  organizationId,
  organizationName,
  onSelected,
  label = "Google Workspace",
}: {
  organizationId: string;
  organizationName: string;
  onSelected: (connectionId: string, fileIds: string[]) => void | Promise<void>;
  label?: string;
}) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [attempt, setAttempt] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const key = `opryn:teach-google:${organizationId}`;
  const connected = useCallback(
    (id: string) => {
      sessionStorage.removeItem(key);
      setSheet(false);
      setConnectionId(id);
      setPickerKey((value) => value + 1);
    },
    [key],
  );
  useEffect(() => {
    if (sessionStorage.getItem(key) !== location.pathname + location.search)
      return;
    const abort = new AbortController();
    void fetch(
      "/api/integrations/capability?provider=google_drive&capability=knowledge_import",
      { signal: abort.signal, cache: "no-store" },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(async (data) => {
        if (abort.signal.aborted) return;
        if (data.connectionId) {
          connected(data.connectionId);
          return;
        }
        const response = await fetch("/api/integrations/nango/session", {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error();
        data = await response.json();
        if (abort.signal.aborted) return;
        const pending = data.attempts?.find(
          (a: { provider: string }) => a.provider === "google_drive",
        );
        setAttempt(pending?.id);
        setSheet(true);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Resume Google connection by choosing Google Workspace again.",
          );
      });
    return () => abort.abort();
  }, [key, connected]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/integrations/capability?provider=google_drive&capability=knowledge_import",
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.connectionId) connected(data.connectionId);
      else {
        sessionStorage.setItem(key, location.pathname + location.search);
        setSheet(true);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google could not open. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connection-action">
      {connectionId ? (
        <GoogleWorkspacePicker
          key={pickerKey}
          autoOpen
          connectionId={connectionId}
          label="Add Google files"
          className="opryn-button-secondary"
          onSelected={(ids) => onSelected(connectionId, ids)}
        />
      ) : (
        <button
          type="button"
          className="opryn-button-secondary"
          disabled={busy}
          onClick={start}
        >
          {busy ? "Checking Google…" : label}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {sheet && (
        <NangoConnection
          provider={getIntegrationCatalogItem("google_drive")!}
          organizationId={organizationId}
          organizationName={organizationName}
          pendingAttemptId={attempt}
          onConnected={connected}
          onClose={() => {
            setSheet(false);
            sessionStorage.removeItem(key);
          }}
        />
      )}
    </div>
  );
}
