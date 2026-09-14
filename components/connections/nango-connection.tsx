"use client";
import { MotionRegion, StaggerList } from "@/components/motion/motion-region";
import { FlowLine } from "@/components/motion/flow-line";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Minus, X } from "lucide-react";
import { DialogSurface } from "@/components/app/dialog-surface";
import { GoogleWorkspacePicker } from "@/components/connections/google-workspace-picker";
import { ProviderLogo } from "@/components/connections/provider-logo";
import type { IntegrationCatalogItem } from "@/lib/integrations/types";

type SelectedFile = {
  id: string;
  name: string;
  type: string;
  processId?: string;
  importedAt?: string;
};
type Details = {
  id: string;
  status: string;
  connected_at: string | null;
  last_sync_at: string | null;
  capabilities: string[];
  error_code: string | null;
  external_account_name?: string | null;
  connected_by_label?: string;
  selected_files?: SelectedFile[];
};
type Stage = "intro" | "authorizing" | "waiting" | "success" | "disconnect";

export function NangoConnection({
  provider,
  organizationId,
  organizationName,
  connectionId,
  pendingAttemptId,
  returnTo = "/app/integrations",
  onClose,
  onConnected,
}: {
  provider: IntegrationCatalogItem;
  organizationId: string;
  organizationName: string;
  connectionId?: string;
  pendingAttemptId?: string;
  returnTo?: string;
  onClose: () => void;
  onConnected?: (connectionId: string) => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(
    pendingAttemptId ? "waiting" : "intro",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState(
    connectionId ?? null,
  );
  const [attemptId, setAttemptId] = useState<string | null>(
    pendingAttemptId ?? null,
  );
  const alive = useRef(true);
  const running = useRef(false);
  const cancelled = useRef(false);
  const authClient = useRef<{ clear(): void } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelled.current = true;
      authClient.current?.clear();
    };
  }, []);

  async function loadDetails(id = activeConnectionId) {
    if (!id) return;
    const response = await fetch(`/api/integrations/nango/${id}`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error("Connection details could not be loaded.");
    setDetails(await response.json());
  }

  useEffect(() => {
    if (!activeConnectionId) return;
    const abort = new AbortController();
    fetch(`/api/integrations/nango/${activeConnectionId}`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Connection details could not be loaded.");
        return response.json();
      })
      .then((data) => setDetails(data))
      .catch((loadError) => {
        if (!abort.signal.aborted) setError(loadError.message);
      });
    return () => abort.abort();
  }, [activeConnectionId]);

  useEffect(() => {
    if (!attemptId || stage !== "waiting") return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 120_000;
    async function poll() {
      if (abort.signal.aborted) return;
      try {
        const response = await fetch(
          `/api/integrations/nango/attempts/${attemptId}`,
          { signal: abort.signal, cache: "no-store" },
        );
        if (!response.ok)
          throw new Error(
            "Could not confirm this connection. Reopen Connections to check its status.",
          );
        const data = await response.json();
        if (data.status === "confirmed") {
          if (onConnected && data.connectionId) {
            onConnected(data.connectionId);
            return;
          }
          setActiveConnectionId(data.connectionId);
          setStage("success");
          setError("");
          router.refresh();
          return;
        }
        if (data.status !== "pending" || Date.now() > deadline)
          throw new Error("Google authorization was not confirmed. Try again.");
        timer = setTimeout(poll, 1600);
      } catch (pollError) {
        if (!abort.signal.aborted) {
          setStage("intro");
          setError(
            pollError instanceof Error
              ? pollError.message
              : "Could not confirm Google authorization.",
          );
        }
      }
    }
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [attemptId, stage, router, onConnected]);

  async function cancelAttempt() {
    if (!attemptId) return;
    const response = await fetch(
      `/api/integrations/nango/attempts/${attemptId}`,
      { method: "DELETE" },
    );
    if (!response.ok)
      throw new Error("Could not cancel the previous attempt. Please retry.");
    setAttemptId(null);
  }

  async function connect() {
    if (running.current) return;
    running.current = true;
    cancelled.current = false;
    setBusy(true);
    setError("");
    try {
      await cancelAttempt();
      setStage("authorizing");
      const response = await fetch("/api/integrations/nango/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, organizationId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not start Google authorization.");
      setAttemptId(data.attemptId);
      const { default: Nango, AuthError } = await import("@nangohq/frontend");
      const nango = new Nango({ connectSessionToken: data.sessionToken });
      authClient.current = nango;
      try {
        const result = await (data.reconnect
          ? nango.reconnect(data.integrationId, {
              detectClosedAuthWindow: true,
            })
          : nango.auth(data.integrationId, { detectClosedAuthWindow: true }));

        // Nango's popup has already verified the provider authorization. Confirm
        // the returned reference server-side so the UI does not depend solely on
        // webhook delivery timing. The server re-reads the connection from Nango
        // and validates its organization/user tags before persisting anything.
        const confirmation = await fetch(
          `/api/integrations/nango/attempts/${data.attemptId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionId: result.connectionId,
              providerConfigKey: result.providerConfigKey,
            }),
          },
        );
        if (confirmation.ok) {
          const confirmed = await confirmation.json();
          if (alive.current && !cancelled.current) {
            if (onConnected && confirmed.connectionId) {
              onConnected(confirmed.connectionId);
              return;
            }
            setActiveConnectionId(confirmed.connectionId);
            setStage("success");
            setError("");
            router.refresh();
          }
          return;
        }
      } catch (authError) {
        if (authError instanceof AuthError) {
          if (authError.type === "blocked_by_browser")
            throw new Error(
              "Your browser blocked the sign-in window. Try again.",
            );
          if (authError.type === "window_closed")
            throw new Error("Google connection cancelled.");
          if (
            ["connection_validation_failed", "connection_test_failed"].includes(
              authError.type,
            )
          )
            throw new Error("Opryn wasn’t given access.");
        }
        throw new Error("Google couldn’t be connected right now. Try again.");
      } finally {
        nango.clear();
      }
      if (alive.current && !cancelled.current) setStage("waiting");
    } catch (connectError) {
      if (alive.current && !cancelled.current) {
        setStage("intro");
        setError(
          connectError instanceof Error
            ? connectError.message
            : "Google couldn’t be connected right now. Try again.",
        );
      }
    } finally {
      running.current = false;
      authClient.current = null;
      if (alive.current) setBusy(false);
    }
  }

  async function disconnect() {
    if (running.current || !activeConnectionId) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${activeConnectionId}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.refresh();
      onClose();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect. Please retry.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <DialogSurface
      onClose={onClose}
      labelledBy="nango-sheet-title"
      className="dialog-review"
      busy={busy}
      animate={stage !== "disconnect"}
    >
      <section className="connection-sheet dialog-content">
        <header className="connection-sheet-header">
          <div className="flex items-center gap-4">
            <ProviderLogo id={provider.id} name={provider.name} />
            <h2 id="nango-sheet-title">Google Workspace</h2>
          </div>
          <button
            type="button"
            aria-label="Close Google Workspace connection"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        <div className="connection-sheet-body">
          <p className="connection-eyebrow">For {organizationName}</p>
          {stage === "authorizing" || stage === "waiting" ? (
            <ConnectionProgress
              waiting={stage === "waiting"}
              onCancel={() => {
                cancelled.current = true;
                authClient.current?.clear();
                running.current = false;
                setBusy(false);
                void cancelAttempt()
                  .then(() => {
                    setStage("intro");
                    setError("Google connection cancelled.");
                  })
                  .catch((cancelError) => setError(cancelError.message));
              }}
            />
          ) : stage === "success" ? (
            <SuccessState
              connectionId={activeConnectionId}
              onFilesChanged={async () => {
                await loadDetails();
                setStage("intro");
              }}
              onDone={() => {
                router.refresh();
                if (returnTo !== "/app/integrations") router.push(returnTo);
                else onClose();
              }}
            />
          ) : stage === "disconnect" ? (
            <div data-motion-immediate>
              <h3>Disconnect Google Workspace?</h3>
              <p>
                Opryn will stop accessing this Google connection. Knowledge
                already approved in Opryn will not be deleted automatically.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className="opryn-action"
                  disabled={busy}
                  onClick={disconnect}
                >
                  {busy ? "Disconnecting…" : "Disconnect"}
                </button>
                <button
                  className="opryn-button-secondary"
                  disabled={busy}
                  onClick={() => setStage("intro")}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : activeConnectionId ? (
            <ManageConnection
              details={details}
              connectionId={activeConnectionId}
              onFilesChanged={() => loadDetails()}
              onReconnect={connect}
              onDisconnect={() => setStage("disconnect")}
            />
          ) : (
            <ConnectIntro onConnect={connect} onCancel={onClose} busy={busy} />
          )}
          {error ? (
            <p role="alert" className="connection-error">
              {error}
            </p>
          ) : null}
          <Link href="/security" className="text-sm underline">
            How Opryn handles your data
          </Link>
        </div>
      </section>
    </DialogSurface>
  );
}

function ConnectIntro({
  onConnect,
  onCancel,
  busy,
}: {
  onConnect: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <>
      <div>
        <h3>Connect your Google account.</h3>
        <p className="mt-3">Choose company files Opryn can learn from.</p>
      </div>
      <PermissionList
        title="Opryn can"
        items={[
          "Access files you explicitly choose",
          "Read supported Docs, Sheets, and Slides",
          "Keep the original Google file attached as the source",
        ]}
        positive
      />
      <PermissionList
        title="Opryn will not"
        items={[
          "Read your entire Drive",
          "Delete your files",
          "Automatically approve imported information",
        ]}
      />
      <div className="flex flex-wrap gap-3">
        <button className="opryn-action" disabled={busy} onClick={onConnect}>
          Continue with Google
        </button>
        <button
          className="opryn-button-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function PermissionList({
  title,
  items,
  positive = false,
}: {
  title: string;
  items: string[];
  positive?: boolean;
}) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <ul className="connection-permissions">
        {items.map((item) => (
          <li key={item}>
            {positive ? <Check size={17} /> : <Minus size={17} />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConnectionProgress({
  waiting,
  onCancel,
}: {
  waiting: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      <div>
        <h3>
          {waiting
            ? "Confirming Google Workspace…"
            : "Connecting Google Workspace…"}
        </h3>
        <p className="mt-3">
          {waiting
            ? "Opryn is securely confirming the connection."
            : "Finish signing in with Google in the window that opened."}
        </p>
      </div>
      <FlowLine />
      <button className="opryn-button-secondary" onClick={onCancel}>
        Cancel authorization
      </button>
    </>
  );
}

function SuccessState({
  connectionId,
  onFilesChanged,
  onDone,
}: {
  connectionId: string | null;
  onFilesChanged: () => void | Promise<void>;
  onDone: () => void;
}) {
  return (
    <MotionRegion variant="status" className="connection-success-state">
      <Check className="connection-success-check" size={30} aria-hidden />
      <div>
        <h3>Google Workspace connected</h3>
        <p className="mt-3">Opryn can now access the files you choose.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {connectionId ? (
          <GoogleWorkspacePicker
            connectionId={connectionId}
            onSelected={onFilesChanged}
          />
        ) : null}
        <button className="opryn-button-secondary" onClick={onDone}>
          Done
        </button>
      </div>
    </MotionRegion>
  );
}

function ManageConnection({
  details,
  connectionId,
  onFilesChanged,
  onReconnect,
  onDisconnect,
}: {
  details: Details | null;
  connectionId: string;
  onFilesChanged: () => void | Promise<void>;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <>
      <div>
        <h3>
          {details?.status === "connected" ? "Connected" : "Needs attention"}
        </h3>
        <p className="mt-3">
          Opryn can learn only from the Google files selected below.
        </p>
      </div>
      {details ? (
        <dl className="connection-facts">
          <div>
            <dt>Connected account</dt>
            <dd>{details.external_account_name ?? "Google account"}</dd>
          </div>
          <div>
            <dt>Connected by</dt>
            <dd>{details.connected_by_label ?? "Workspace administrator"}</dd>
          </div>
          <div>
            <dt>Last successful access</dt>
            <dd>
              {details.last_sync_at
                ? new Date(details.last_sync_at).toLocaleDateString()
                : "No files learned yet"}
            </dd>
          </div>
        </dl>
      ) : (
        <p role="status">Loading connection details…</p>
      )}
      {details?.status === "connected" ? (
        <SelectedFiles
          connectionId={connectionId}
          files={details.selected_files ?? []}
          onChanged={onFilesChanged}
        />
      ) : null}
      <div className="flex flex-wrap gap-3">
        <GoogleWorkspacePicker
          connectionId={connectionId}
          onSelected={onFilesChanged}
          label={
            (details?.selected_files?.length ?? 0) > 0
              ? "Choose more files"
              : "Choose files"
          }
        />
        <button className="opryn-button-secondary" onClick={onReconnect}>
          Reconnect
        </button>
        <button className="opryn-button-secondary" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </>
  );
}

function SelectedFiles({
  connectionId,
  files,
  onChanged,
}: {
  connectionId: string;
  files: SelectedFile[];
  onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  async function remove(fileId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${connectionId}/files`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await onChanged();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove that file.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function learn() {
    if (!files.length) return;
    setBusy(true);
    setError("");
    const next: Record<string, string> = {};
    for (const file of files) {
      if (file.processId) {
        next[file.id] = file.processId;
        continue;
      }
      try {
        const response = await fetch(
          `/api/integrations/nango/${connectionId}/import`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: file.id }),
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        next[file.id] = data.processId;
      } catch (learnError) {
        setError(
          learnError instanceof Error
            ? `${file.name}: ${learnError.message}`
            : `${file.name} could not be learned.`,
        );
      }
    }
    setResults(next);
    setBusy(false);
    await onChanged();
  }
  if (!files.length)
    return (
      <section className="connection-files">
        <h4>Selected files</h4>
        <p>No files selected yet.</p>
      </section>
    );
  return (
    <section className="connection-files">
      <h4>Selected files</h4>
      <StaggerList changeKey={files.map((file) => file.id).join("|")}>
        {files.map((file) => (
          <div
            className="connection-file"
            key={file.id}
            data-motion-row={file.id}
          >
            <FileText size={18} aria-hidden />
            <span>
              <strong>{file.type}</strong>
              <small>{file.name}</small>
            </span>
            <span className="connection-file-actions">
              {file.processId || results[file.id] ? (
                <Link
                  href={`/app/processes/${file.processId ?? results[file.id]}`}
                >
                  Review
                </Link>
              ) : null}
              <button disabled={busy} onClick={() => remove(file.id)}>
                Remove
              </button>
            </span>
          </div>
        ))}
      </StaggerList>
      <button className="opryn-action" disabled={busy} onClick={learn}>
        {busy ? "Learning from files…" : "Learn from these files"}
      </button>
      {error ? (
        <p role="alert" className="connection-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
