"use client";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";

export function GapRecheck({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function retry() {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/knowledge-proposals/${proposalId}/recheck`,
        { method: "POST", signal: active.signal },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error || "The recheck couldn't finish. Try again.",
        );
      const results = Array.isArray(body.results) ? body.results : [];
      setMessage(
        !results.length
          ? "No questions are ready to recheck. If another check is running, wait five minutes before retrying."
          : results.every(
                (item: { status: string }) => item.status === "answered",
              )
            ? "Checked this batch against approved sources. The gap closes only after every recorded question is verified."
            : "Some questions still need more approved guidance or another recheck.",
      );
      router.refresh();
    } catch (error) {
      if (!active.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Please try again.",
        );
    } finally {
      controller.current = null;
      if (!active.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="opryn-action"
          onClick={retry}
          disabled={busy}
        >
          {busy ? (
            <OprynThinkingOrb
              state="searching"
              size={20}
              label="Checking approved guidance"
              decorative
            />
          ) : null}
          {busy ? "Checking approved guidance…" : "Recheck questions"}
        </button>
        <Link href="/app/processes/new" className="opryn-button-secondary">
          Teach more detail
        </Link>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-[var(--opryn-muted)]"
      >
        {message ||
          (busy
            ? "Checking each asker’s permitted approved sources."
            : "No messages are sent to external integrations.")}
      </p>
    </div>
  );
}
