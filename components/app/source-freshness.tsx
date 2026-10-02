"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionRegion } from "@/components/motion/motion-region";
import type { SourceFreshness } from "@/lib/opryn/knowledge/source-freshness";

export function SourceFreshnessList({
  sources,
  limited,
}: {
  sources: SourceFreshness[];
  limited: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("en-US") : "Not recorded";
  async function check(integration: string) {
    if (busy) return;
    setBusy(integration);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/integrations/nango/${integration}/check`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Source check could not finish.");
      const rows = result.results as Array<{
        changed: boolean;
        unavailable?: boolean;
        retryable?: boolean;
        busy?: boolean;
        prepared?: boolean;
      }>;
      const changed = rows.filter((r) => r.prepared || r.changed).length,
        failed = rows.filter((r) => r.unavailable || r.retryable).length;
      setMessage(
        `Checked ${result.checked} selected sources (up to 20 per check). ${changed} new revisions require review.${failed ? ` ${failed} sources need attention.` : ""}${rows.some((r) => r.busy) ? " An import is already running." : ""}`,
      );
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Source check could not finish.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <MotionRegion variant="quiet">
      <div>
        <p className="mb-4 text-sm text-[#566279]">
          Only selected Google Workspace, Notion and Confluence sources are
          checked. Approved guidance stays in place until a replacement is
          approved. Missing access never deletes company knowledge.
        </p>
        {limited ? (
          <p role="status" className="mb-4 text-sm">
            Showing the first 500 source records, not a workspace total.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-red-200 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
        <ul className="divide-y divide-[#d7e3f1]">
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
            >
              <div className="min-w-0 flex-1 basis-52">
                <h3 className="break-words font-semibold">{source.title}</h3>
                <p className="mt-1 text-sm text-[#2855f9]">
                  {(
                    {
                      google_drive: "Google Workspace",
                      notion: "Notion",
                      confluence: "Confluence",
                    } as Record<string, string>
                  )[source.provider] ?? source.provider}{" "}
                  · {source.reason ?? "No recorded source issue"}
                </p>
                <p className="mt-2 text-xs leading-6 text-[#566279]">
                  Last successful check:{" "}
                  {date(
                    source.last_successful_check_at ?? source.last_imported_at,
                  )}
                  <br />
                  Last attempt: {date(source.last_checked_at)} · Source version:{" "}
                  {source.provider_version ?? "Not supplied"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
                  href={`/app/knowledge/sources/${source.id}`}
                >
                  Source history
                </Link>
                {source.process_id &&
                source.process_id !== source.approved_process_id &&
                source.review_status !== "declined" ? (
                  <Link
                    className="opryn-action"
                    href={`/app/processes/${source.process_id}?review=true&returnTo=%2Fapp%2Fknowledge%2Fhealth`}
                  >
                    Review findings
                  </Link>
                ) : null}
                {source.connectionStatus === "connected" ? (
                  <button
                    type="button"
                    className="opryn-button-secondary min-h-11 px-3"
                    disabled={busy !== null}
                    onClick={() => void check(source.integration_id)}
                  >
                    {busy === source.integration_id
                      ? "Checking selected sources…"
                      : "Check for updates"}
                  </button>
                ) : (
                  <Link
                    className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
                    href="/app/connections"
                  >
                    Manage connection
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!sources.length ? (
          <p className="rounded-2xl bg-[#eaf4ff] p-5 text-sm">
            Import selected content in Teach Opryn to begin tracking its source
            freshness. Legacy Google files enter tracking when imported again.
          </p>
        ) : null}
      </div>
    </MotionRegion>
  );
}
