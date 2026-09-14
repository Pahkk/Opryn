import Link from "next/link";

type Entry = {
  id: string;
  content: string;
  source_type: string;
  process_id: string | null;
  rule_id: string | null;
  last_confirmed_at: string | null;
  current_version: number;
  role_id: string | null;
};

/** Approved, RLS-filtered entries from the same knowledge store used by Ask. */
export function KnowledgeEntries({
  entries,
  canReviewHistory,
  accessibleProcesses,
}: {
  entries: Entry[];
  canReviewHistory: boolean;
  accessibleProcesses: string[];
}) {
  if (!entries.length) return null;
  const processes = new Set(accessibleProcesses);
  return (
    <section className="mt-6" aria-label="Approved rules and answers">
      <h2 className="mb-3 text-lg font-semibold text-[var(--opryn-navy)]">
        Rules & answers
      </h2>
      <div className="divide-y divide-[var(--opryn-line)] overflow-hidden rounded-[20px] border border-[var(--opryn-line)] bg-white">
        {entries.map((entry) => {
          const separator = entry.content.indexOf(":");
          const title =
            separator > 0 && separator < 200
              ? entry.content.slice(0, separator)
              : entry.source_type === "faq"
                ? "Company answer"
                : "Company guidance";
          const text =
            separator > 0 && separator < 200
              ? entry.content.slice(separator + 1).trim()
              : entry.content;
          return (
            <article key={entry.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-[var(--opryn-navy)]">
                  {title}
                </h3>
                <span className="text-xs font-semibold text-[var(--opryn-blue)]">
                  Approved ·{" "}
                  {entry.source_type === "faq"
                    ? "FAQ"
                    : entry.rule_id || entry.source_type === "rule"
                      ? "Rule"
                      : "Guidance"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--opryn-muted)]">
                {text}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--opryn-muted)]">
                <span>Version {entry.current_version}</span>
                <span>
                  {entry.last_confirmed_at
                    ? `Confirmed ${new Date(entry.last_confirmed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
                    : "Not yet reconfirmed"}
                </span>
                <span>
                  {entry.role_id ? "Role-restricted" : "Workspace access"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold text-[var(--opryn-blue)]">
                <Link
                  className="inline-flex min-h-11 items-center"
                  href={`/app/ask?q=${encodeURIComponent(`What does our approved guidance say about ${title}?`)}`}
                >
                  Ask Opryn about this
                </Link>
                {entry.process_id && processes.has(entry.process_id) ? (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    href={`/app/processes/${entry.process_id}${entry.rule_id ? `#rule-${entry.rule_id}` : ""}`}
                  >
                    Open supporting process
                  </Link>
                ) : null}
                {canReviewHistory ? (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    href={`/app/knowledge/${entry.id}/history`}
                  >
                    Source & history
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
