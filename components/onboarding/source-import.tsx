"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  LEARNING_FILE_ACCEPT,
  LEARNING_FILE_HELP,
  learningFileType,
} from "@/lib/learning-files";

export function SourceImport({
  mode,
  onBack,
  returnTo = "/onboarding?step=teach",
  onPrepared,
}: {
  mode: "documents" | "drive";
  onBack: () => void;
  returnTo?: string;
  onPrepared?: (processId: string) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ name: string; id: string }>>(
    [],
  );
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [completed, setCompleted] = useState(() => new Set<File>());
  const [currentSource, setCurrentSource] = useState("");
  async function learn() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const sources =
        mode === "drive"
          ? [{ name: "Google Drive document", file: null }]
          : files.map((file) => ({ name: file.name, file }));
      for (const source of sources) {
        if (source.file ? completed.has(source.file) : results.length > 0)
          continue;
        setCurrentSource(source.name);
        const form = new FormData();
        if (source.file) form.set("file", source.file);
        const response = source.file
          ? await fetch("/api/processes/import", {
              method: "POST",
              body: form,
            })
          : await fetch("/api/processes", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                title: source.name,
                description:
                  "Company source supplied during onboarding. Findings require owner review.",
                inputType: mode === "drive" ? "google_drive" : "text",
                captureMethod: mode === "drive" ? "google_drive" : "text",
                driveUrl: url,
              }),
            });
        const body = await response.json().catch(() => ({
          error: "The upload couldn't finish. Check your connection and retry.",
        }));
        if (!response.ok)
          throw new Error(
            body.error ||
              "This source couldn't be read. Your completed imports are safe.",
          );
        if (source.file)
          setCompleted((current) => new Set(current).add(source.file!));
        setResults((current) => [
          ...current,
          { name: source.name, id: body.processId },
        ]);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your import couldn't finish. Try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const styles =
    "inline-flex min-h-12 items-center rounded-2xl bg-[#146bff] px-6 py-3 text-sm font-bold text-white disabled:opacity-50";
  return (
    <section className="source-first-learning pb-24 sm:pb-6">
      <p className="text-sm font-bold text-[#146bff]">
        Learn from what you already use
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {busy
          ? "Opryn is learning."
          : results.length
            ? "Your findings are ready."
            : mode === "drive"
              ? "Bring in a Drive document."
              : "Choose your business files."}
      </h2>
      <p className="mt-4 leading-7 text-[#52627a]">
        {mode === "drive"
          ? "Paste a document link that already allows sharing. For private documents, download a Word or PDF copy and upload it instead."
          : LEARNING_FILE_HELP}
      </p>
      {mode === "documents" ? (
        <p className="mt-3 text-sm leading-6 text-[#52627a]">
          Use clear screenshots or photos. Word files are read as text; upload
          embedded diagrams separately or export to PDF. Opryn saves reviewable
          findings and the source filename, not the original file.
        </p>
      ) : null}
      {!busy ? (
        <div className="mt-7">
          {mode === "drive" ? (
            <label className="block font-semibold">
              Google Drive sharing link
              <input
                className="onboarding-input mt-3"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://docs.google.com/document/d/…"
              />
            </label>
          ) : (
            <label className="block rounded-3xl border border-dashed border-[#b3c9e5] bg-[#f3f7ff] p-8 font-semibold">
              Select up to 6 files
              <input
                className="mt-4 block w-full text-sm"
                type="file"
                multiple
                accept={LEARNING_FILE_ACCEPT}
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  try {
                    if (selected.length > 6)
                      throw new Error("Choose up to 6 files at a time.");
                    selected.forEach(learningFileType);
                  } catch (failure) {
                    setFiles([]);
                    setError((failure as Error).message);
                    return;
                  }
                  setFiles(selected);
                  setError("");
                }}
              />
            </label>
          )}
          {files.length ? (
            <p className="mt-4 font-semibold">
              {files.length} {files.length === 1 ? "file" : "files"} selected.
            </p>
          ) : null}
        </div>
      ) : null}
      {busy ? (
        <p role="status" className="mt-6 rounded-2xl bg-[#f3f7ff] p-5">
          {results.length} sources organized. Reading {currentSource} and
          preparing findings for review… Keep this page open while the upload
          finishes.
        </p>
      ) : null}
      {results.map((result) => (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#dbe3ee] py-4"
          key={result.id}
        >
          <div>
            <h3 className="break-words font-bold">{result.name}</h3>
            <p className="text-sm text-[#94631e]">Needs Review</p>
          </div>
          {onPrepared ? <button className={styles} onClick={() => onPrepared(result.id)}>Review findings</button> : <Link
            className={styles}
            href={`/app/processes/${result.id}?returnTo=${encodeURIComponent(returnTo)}`}
          >
            Review Findings
          </Link>}
        </div>
      ))}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#a23d3d]">
          {error}
        </p>
      ) : null}
      <div className="mt-7 flex flex-wrap gap-4">
        {(
          mode === "documents"
            ? files.some((file) => !completed.has(file)) || !results.length
            : !results.length
        ) ? (
          <button
            className={styles}
            disabled={busy || (mode === "drive" ? !url.trim() : !files.length)}
            onClick={() => void learn()}
          >
            {busy ? "Learning…" : error ? "Try Again" : "Start Learning"}
          </button>
        ) : null}
        <button
          className="min-h-12 px-3 font-semibold"
          onClick={onBack}
          disabled={busy}
        >
          Back to Sources
        </button>
      </div>
    </section>
  );
}
