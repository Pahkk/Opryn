"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, RotateCcw } from "lucide-react";

const statusCopy: Record<string, string> = {
  received: "Recording received",
  downloading: "Downloading securely from Twilio",
  downloaded: "Recording downloaded",
  extracting_audio: "Preparing audio",
  transcribing: "Transcribing conversation",
  transcribed: "Transcript ready",
  analyzing: "Finding useful company knowledge",
  failed: "Processing needs attention",
  absent: "Recording unavailable",
  skipped: "Call skipped by your learning settings",
};

export function CallProcessing({
  callId,
  status,
  errorMessage,
}: {
  callId: string;
  status: string;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canStart = status === "received" || status === "failed";
  const activelyProcessing = [
    "downloading",
    "downloaded",
    "extracting_audio",
    "transcribing",
    "transcribed",
    "analyzing",
  ].includes(status);

  async function start() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/calls/${callId}/learn`, {
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(body.error ?? "Opryn couldn't start call analysis.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-[#dfe5ed] bg-white p-6 text-center sm:p-9">
      <span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
        {busy || activelyProcessing ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : status === "absent" || status === "skipped" ? (
          <AlertCircle className="size-5" />
        ) : (
          <RotateCcw className="size-5" />
        )}
      </span>
      <h2 className="mt-5 text-lg font-semibold">
        {statusCopy[status] ?? "Preparing this call"}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#718095]">
        {errorMessage ||
          "Opryn keeps completed stages so a retry does not repeat transcription work."}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#a83f49]">
          {error}
        </p>
      ) : null}
      {canStart ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <RotateCcw className="size-4" />
          )}
          {status === "failed" ? "Retry analysis" : "Analyze this call"}
        </button>
      ) : null}
    </section>
  );
}
