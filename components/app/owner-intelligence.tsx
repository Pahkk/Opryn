import Link from "next/link";
import type { OwnerIntelligence } from "@/lib/opryn/owner-intelligence";
import { MotionRegion } from "@/components/motion/motion-region";
export function OwnerIntelligencePanel({
  data: d,
}: {
  data: OwnerIntelligence;
}) {
  return (
    <MotionRegion
      variant="quiet"
      className="my-6 rounded-3xl border border-[#cdddf3] bg-[#EAF4FF] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="opryn-section-label">OPRYN TODAY</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Less interruption. More company knowledge.
          </h2>
        </div>
        <Link href="/app/knowledge/analysis" className="opryn-secondary-action">
          Analyze company knowledge
        </Link>
      </div>
      <p className="mt-2 text-sm text-[#566279]">
        Recorded activity · last 30 days. Open gaps are the current workspace
        total.
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
        {[
          ["Answered without human routing", d.handledTeam + d.handledAI],
          ["Questions routed to a human", d.escalated],
          ["Open knowledge gaps", d.openGaps],
          ["Recently resolved gaps", d.resolvedGaps],
          ["Human answers made official", d.humanKnowledge],
          ["Estimated time returned", `${d.estimatedMinutes} min`],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs leading-5 text-[#566279]">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[#14213D]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <details className="mt-5 border-t border-[#cdddf3] pt-3 text-xs leading-5 text-[#566279]">
        <summary className="min-h-8 cursor-pointer font-semibold">
          How these numbers work
        </summary>
        <p>
          Estimated time: {d.eligibleQuestions} eligible employee questions ×{" "}
          {d.minutesPerQuestion} minutes (your workspace setting), rounded. Same
          person/question/day duplicates, negative feedback, human-routed
          questions and external AI are excluded from savings. This estimates
          avoided explanation time—not measured hours worked.
        </p>
        <p className="mt-2">
          Resolved gaps are currently resolved clusters updated in this period,
          not a lifetime event count. AI answers use retained lookup logs, so
          older expired logs are not included. No claim is made that every
          repeat question was eliminated.
        </p>
      </details>
      {d.aiLogsLimitedByRetention && (
        <p className="mt-3 text-xs text-[#566279]">
          Some AI logs have a retention period under 30 days; AI totals cover
          only retained records.
        </p>
      )}
      {d.keyPersonDependencies.length > 0 && (
        <div className="mt-4 border-t border-[#cdddf3] pt-4">
          <p className="text-sm font-semibold">
            Capture answers that depend on one expert
          </p>
          {d.keyPersonDependencies.slice(0, 3).map((r) => (
            <Link
              key={r.id}
              href="/app/needs-you"
              className="mt-2 block text-sm text-[#2855F9]"
            >
              {r.topic} · {r.questions} recent unresolved questions routed to
              one person →
            </Link>
          ))}
          <p className="mt-2 text-xs text-[#566279]">
            Observed routing dependency, not an employee performance measure or
            proof of all uncaptured knowledge.
          </p>
        </div>
      )}
    </MotionRegion>
  );
}
