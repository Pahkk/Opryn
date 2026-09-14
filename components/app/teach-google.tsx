"use client";
import "./knowledge-library.css";
import { useState } from "react";
import Link from "next/link";
import { ConnectionAction } from "@/components/connections/connection-action";
import { StaggerList } from "@/components/motion/motion-region";

type FileRow = {
  id: string;
  name: string;
  type: string;
  processId?: string;
  error?: string;
};
export function TeachGoogle({
  organizationId,
  organizationName,
  onPrepared,
}: {
  organizationId: string;
  organizationName: string;
  onPrepared?: (processId: string) => void;
}) {
  const [connection, setConnection] = useState("");
  const [files, setFiles] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function selected(id: string, ids: string[]) {
    setConnection(id);
    setError("");
    const response = await fetch(`/api/integrations/nango/${id}/files`, {
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        "Your selection was saved, but could not be displayed. Choose the files again to retry.",
      );
    const data = await response.json();
    setFiles((previous) => {
      const map = new Map(previous.map((file) => [file.id, file]));
      for (const file of data.files as FileRow[])
        if (ids.includes(file.id)) map.set(file.id, file);
      return [...map.values()];
    });
  }
  async function learn() {
    if (busy) return;
    setError("");
    for (const file of files.filter((f) => !f.processId)) {
      setBusy(file.id);
      try {
        const response = await fetch(
          `/api/integrations/nango/${connection}/import`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: file.id }),
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "This file could not be processed.");
        setFiles((current) =>
          current.map((f) =>
            f.id === file.id
              ? { ...f, processId: data.processId, error: undefined }
              : f,
          ),
        );
      } catch (e) {
        setFiles((current) =>
          current.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  error: e instanceof Error ? e.message : "Retry this file.",
                }
              : f,
          ),
        );
      }
    }
    setBusy(null);
  }
  return (
    <section className="teach-google" aria-label="Teach from Google Workspace">
      <ConnectionAction
        label="Choose Google files"
        organizationId={organizationId}
        organizationName={organizationName}
        onSelected={selected}
      />
      {!!files.length && (
        <div className="connection-files">
          <h2 className="text-lg font-semibold">Your Google files</h2>
          <p className="text-sm">
            Opryn prepares findings. You decide what becomes approved knowledge.
          </p>
          <StaggerList changeKey={files.map((file) => file.id).join("|")}>
            {files.map((file) => (
              <div
                className="connection-file"
                key={file.id}
                data-motion-row={file.id}
              >
                <span>
                  <strong>{file.type}</strong>
                  <small>{file.name}</small>
                  {file.error && <span role="alert">{file.error}</span>}
                  {busy === file.id && (
                    <span role="status">Preparing findings…</span>
                  )}
                </span>
                {file.processId ? (
                  onPrepared ? <button className="opryn-button-secondary" onClick={() => onPrepared(file.processId!)}>Review findings</button> : <Link
                    className="opryn-button-secondary"
                    href={`/app/processes/${file.processId}?review=true&returnTo=%2Fapp%2Fprocesses`}
                  >
                    Review findings
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((f) => f.id !== file.id),
                      )
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </StaggerList>
          {files.some((file) => !file.processId) && (
            <button className="opryn-action" disabled={!!busy} onClick={learn}>
              {busy
                ? "Preparing findings…"
                : files.some((file) => file.error)
                  ? "Retry unfinished files"
                  : "Learn from these files"}
            </button>
          )}
          {files.every((file) => file.processId) && (
            <p role="status">
              Your findings are ready to review. Nothing has been approved
              automatically.
            </p>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
