"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MotionRegion } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";

export function ConflictReplacement({
  id,
  firstVersion,
  secondVersion,
  applicability,
}: {
  id: string;
  firstVersion: number;
  secondVersion: number;
  applicability: string;
}) {
  const router = useRouter(),
    request = useRef<AbortController | null>(null);
  const [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [published, setPublished] = useState<string | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/knowledge-conflicts/${id}/replace`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          reviewed,
          expectedFirstVersion: firstVersion,
          expectedSecondVersion: secondVersion,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "The rule could not be published.");
      if (!controller.signal.aborted) {
        setPublished(result.knowledgeId || "");
        router.refresh();
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Please retry this review.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (published !== null)
    return (
      <div className="mt-4 rounded-2xl bg-[#eaf4ff] p-4">
        <p role="status">
          Updated rule approved. Both previous answers were withdrawn; history
          and source provenance remain.
        </p>
        {published ? (
          <Link
            className="opryn-button-secondary mt-3 inline-flex min-h-11 items-center px-3"
            href={`/app/knowledge/${published}/impact`}
          >
            View impact
          </Link>
        ) : null}
      </div>
    );
  return (
    <details className="mt-5 rounded-2xl border border-[#cbdcf0] bg-[#eaf4ff] p-4">
      <summary className="cursor-pointer font-semibold">
        Create an updated rule
      </summary>
      <MotionRegion variant="quiet">
        <form className="mt-4 space-y-4" onSubmit={(e) => void submit(e)}>
          <p className="text-sm leading-6 text-[#566279]">
            Write and approve the guidance your business should use instead.
            Both previous answers are withdrawn; their history and sources
            remain. Related processes will need review.
          </p>
          <p className="break-words text-xs leading-6">
            Applicability retained from the first answer:{" "}
            {applicability || "Global workspace"}. Its access boundary is
            retained too. Change applicability later through the versioned scope
            editor.
          </p>
          <label className="block text-sm font-semibold">
            Rule title
            <input
              required
              disabled={busy}
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[#cbdcf0] bg-white px-3 py-3"
            />
          </label>
          <label className="block text-sm font-semibold">
            Approved guidance
            <textarea
              required
              disabled={busy}
              minLength={20}
              maxLength={12000}
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[#cbdcf0] bg-white px-3 py-3"
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              className="mt-1 h-5 w-5 shrink-0"
              type="checkbox"
              required
              checked={reviewed}
              disabled={busy}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I reviewed both sources and authorize this replacement as company
            guidance.
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-800">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              className="opryn-action"
              disabled={busy || !reviewed || !firstVersion || !secondVersion}
              type="submit"
            >
              {busy ? "Preparing approved rule…" : "Approve updated rule"}
            </button>
            {busy ? (
              <OprynThinkingOrb
                state="composing"
                size={20}
                label="Preparing approved rule"
                decorative
              />
            ) : null}
          </div>
        </form>
      </MotionRegion>
    </details>
  );
}
