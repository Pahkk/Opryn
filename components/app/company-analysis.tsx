"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnalysisResult } from "@/lib/opryn/company-analysis";
import { MotionRegion } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
type Run = {
  id: string;
  status: string;
  canRetry?: boolean;
  result: Partial<AnalysisResult> & { stage?: string; interrupted?: boolean };
};
export function CompanyAnalysis({
  sources,
  initialRun,
  limited,
}: {
  sources: Array<{
    id: string;
    title: string;
    provider: string;
    connectionStatus: string;
  }>;
  initialRun: Run | null;
  limited: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [run, setRun] = useState(initialRun);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!busy && (run?.status !== "running" || run?.canRetry)) return;
    const c = new AbortController();
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/company-analysis", { signal: c.signal });
        if (!r.ok) return;
        const b = await r.json();
        if (active && b.run) {
          setRun(b.run);
          if (b.run.status !== "running") router.refresh();
        }
      } catch {}
    };
    const interval = setInterval(() => void poll(), 2500);
    return () => {
      active = false;
      c.abort();
      clearInterval(interval);
    };
  }, [busy, run?.status, run?.canRetry, router]);
  async function analyze() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/company-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceIds: selected }),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      setRun(b.run);
      setMessage("Analysis saved. Findings still require human review.");
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Analysis could not finish. Check Needs You for saved findings.",
      );
    } finally {
      setBusy(false);
    }
  }
  const working = busy || (run?.status === "running" && !run.canRetry);
  const snap = run?.result.snapshot;
  return (
    <div data-guide="knowledge.analysis" className="space-y-6">
      <section className="rounded-3xl border border-[#cdddf3] bg-[#EAF4FF] p-5 sm:p-7">
        <h2 className="text-xl font-semibold">Choose what Opryn may analyze</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#566279]">
          Only content already selected in Teach Opryn is available. Choose up
          to two sources per run. New or changed content is structured into
          reviewable findings; unchanged sources aren’t extracted again. Nothing
          is automatically approved.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Search selected sources
          <input
            className="opryn-input mt-2 w-full"
            placeholder="Search sources…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="mt-3 max-h-80 overflow-y-auto divide-y divide-[#cdddf3]">
          {sources
            .filter((s) =>
              `${s.title} ${s.provider}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((s) => (
              <label
                key={s.id}
                className="flex min-h-16 items-center gap-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={
                    working ||
                    s.connectionStatus !== "connected" ||
                    (selected.length === 2 && !selected.includes(s.id))
                  }
                  checked={selected.includes(s.id)}
                  onChange={() =>
                    setSelected((v) =>
                      v.includes(s.id)
                        ? v.filter((id) => id !== s.id)
                        : [...v, s.id],
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{s.title}</span>
                  <span className="mt-1 block text-xs text-[#566279]">
                    {s.provider.replaceAll("_", " ")} ·{" "}
                    {s.connectionStatus === "connected"
                      ? "Selected source"
                      : "Needs reconnection"}
                  </span>
                </span>
              </label>
            ))}
        </div>
        {limited && (
          <p className="mt-2 text-xs">First 500 selected sources shown.</p>
        )}
        {!sources.length && (
          <p className="mt-4 text-sm">
            No selected sources yet.{" "}
            <Link
              href="/app/processes/new"
              className="font-semibold text-[#2855F9]"
            >
              Choose content in Teach Opryn.
            </Link>
          </p>
        )}
        <button
          disabled={working || !selected.length}
          onClick={() => void analyze()}
          className="opryn-action mt-5"
        >
          {working && run?.result.stage === "extracting" ? (
            <>
              <OprynThinkingOrb
                size={20}
                state="solving"
                label="Structuring selected company information"
                decorative
              />
              Structuring selected information…
            </>
          ) : working ? (
            "Checking selected sources…"
          ) : (
            "Analyze my company knowledge"
          )}
        </button>
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-[#566279]"
        >
          {message}
        </p>
        {run?.status === "running" && (
          <p className="mt-2 text-xs text-[#566279]">
            Your run is saved here. If interrupted, retry becomes available
            after 10 minutes.
          </p>
        )}
      </section>
      {snap && (
        <MotionRegion
          variant="quiet"
          className="rounded-3xl border border-[#dbe5f2] bg-white p-5 sm:p-7"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2855F9]">
            {run?.status === "partial"
              ? "Partial analysis"
              : "Analysis results"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">What Opryn found</h2>
          <p className="mt-2 text-sm text-[#566279]">
            Workspace snapshot at run time—not an approval decision. Source
            findings below show what this run prepared.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {[
              ["Approved processes", snap.approvedProcesses],
              ["Approved rule / owner-answer items", snap.approvedPolicies],
              ["Approved FAQs", snap.approvedFAQs],
              ["Open source conflicts", snap.conflicts],
              ["Open knowledge gaps", snap.openGaps],
              ["Routing dependencies", snap.keyPersonDependencies],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-[#566279]">{label}</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 rounded-2xl bg-[#FFD5B5] p-4 text-sm">
            This run prepared {snap.readyForReview} source findings with{" "}
            {snap.draftRuleCandidates} draft rule candidates. A person decides
            what becomes official.
          </p>
          {snap.limited && (
            <p className="mt-3 text-xs">
              Some workspace issue lists are bounded; these issue counts may be
              partial.
            </p>
          )}
          <ul className="mt-4 divide-y divide-[#dbe5f2]">
            {run?.result.sources?.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-1 text-xs text-[#566279]">
                    {s.status === "prepared"
                      ? "New findings ready for review"
                      : s.status === "unchanged"
                        ? "Unchanged; no new extraction"
                        : s.status === "busy"
                          ? "Already processing elsewhere; retry later"
                          : "Could not read source; check connection and retry"}
                  </p>
                </div>
                {s.processId && (
                  <Link
                    href={`/app/processes/${s.processId}`}
                    className="opryn-secondary-action"
                  >
                    View findings
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <nav
            className="mt-5 flex flex-wrap gap-3"
            aria-label="Analysis next actions"
          >
            <Link href="/app/needs-you" className="opryn-action">
              Review decisions
            </Link>
            <Link
              href="/app/knowledge/health#gaps"
              className="opryn-secondary-action"
            >
              What’s missing
            </Link>
            <Link
              href="/app/knowledge/health#conflicts"
              className="opryn-secondary-action"
            >
              Resolve conflicts
            </Link>
            <Link
              href="/app/knowledge/health#source-updates"
              className="opryn-secondary-action"
            >
              Check source issues ({snap.sourceIssues})
            </Link>
            <Link href="/app/processes/new" className="opryn-secondary-action">
              Teach the next process
            </Link>
          </nav>
        </MotionRegion>
      )}
      {run?.status === "failed" && !snap && (
        <p role="alert" className="rounded-2xl bg-[#FFF2E7] p-4 text-sm">
          The previous analysis was interrupted. Any source findings remain in
          Needs You; select sources to retry.
        </p>
      )}
    </div>
  );
}
