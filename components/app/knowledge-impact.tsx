import Link from "next/link";
import { MotionRegion } from "@/components/motion/motion-region";
import type { KnowledgeImpact } from "@/lib/opryn/knowledge/impact";

export function KnowledgeImpactView({ impact }: { impact: KnowledgeImpact }) {
  const { item, source } = impact;
  return (
    <MotionRegion>
      <div className="mx-auto max-w-4xl min-w-0 space-y-6">
        <header>
          <Link
            href="/app/processes"
            className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
          >
            ← Knowledge
          </Link>
          <p className="mt-6 text-sm font-semibold text-[#2855f9]">
            CHANGE IMPACT · VERSION {item.current_version}
          </p>
          <h1 className="opryn-page-title mt-2">{impact.title}</h1>
          <p className="mt-3 max-w-2xl text-[#566279]">
            See where this guidance is linked, what should be tested, and which
            connections are permitted to retrieve it.
          </p>
        </header>
        {impact.limited ? (
          <p role="status" className="rounded-2xl bg-[#ffd5b5] p-4">
            This is a bounded partial view of a large workspace, not
            organization totals.
          </p>
        ) : null}
        <section className="rounded-3xl border border-[#d7e3f1] bg-white p-5 sm:p-7">
          <p className="font-semibold">
            {item.approved ? "Approved" : "Not active"} · Source:{" "}
            {impact.sourceTitle}
          </p>
          <p className="mt-4 whitespace-pre-wrap break-words leading-7">
            {item.content}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="opryn-action"
              href={`/app/knowledge/test?knowledgeId=${item.id}`}
            >
              Test this answer
            </Link>
            <Link
              className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
              href={`/app/knowledge/${item.id}/history`}
            >
              View versions
            </Link>
          </div>
          {impact.predecessor ? (
            <Link
              className="mt-4 block text-sm text-[#2855f9]"
              href={`/app/processes/${impact.predecessor}`}
            >
              View previous source process →
            </Link>
          ) : null}
        </section>
        <section className="border-y border-[#d7e3f1] py-5">
          <h2 className="text-xl font-semibold">Used by</h2>
          <p className="mt-3 text-sm">
            {impact.employees} employees · {impact.roles} roles ·{" "}
            {impact.permitted.length} authorized agents · {impact.scenarios}{" "}
            training scenarios · {impact.tests.length} saved tests
          </p>
          <Link
            href="/app/training"
            className="mt-3 inline-block text-sm text-[#2855f9]"
          >
            View training →
          </Link>
          <p className="mt-2 text-sm text-[#566279]">
            Material approved changes mark affected employee guidance for update
            and queue dependent agent evaluations.
          </p>
        </section>
        <section className="rounded-3xl bg-[#eaf4ff] p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Tests to review</h2>
          <p className="mt-2 text-sm text-[#566279]">
            {impact.tests.length} saved tests reference this knowledge. Reruns
            compare your saved expected outcome and sources.
          </p>
          {impact.tests.length ? (
            <ul className="mt-4 divide-y divide-[#cbdcf0]">
              {impact.tests.map((test) => (
                <li
                  key={test.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>{test.title}</span>
                  <Link
                    className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
                    href={`/app/knowledge/test?testId=${test.id}`}
                  >
                    Open test →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm">
              Save a test in Test Opryn to track an important answer.
            </p>
          )}
        </section>
        <section className="border-t border-[#d7e3f1] pt-6">
          <h2 className="text-xl font-semibold">Observed use</h2>
          <p className="mt-3">
            {impact.questionCount} recorded questions cited this item
            {impact.replacedIds.length ? " or its replaced guidance" : ""} in
            the last 30 days.
          </p>
          <p className="mt-2 text-sm text-[#566279]">
            These citations identify the knowledge item, not a historical
            version. External lookup logs do not yet record every cited item. No
            claim is made that an AI has refreshed.
          </p>
        </section>
        <section className="border-t border-[#d7e3f1] pt-6">
          <h2 className="text-xl font-semibold">
            Connections permitted by access policy
          </h2>
          <p className="mt-2 text-sm text-[#566279]">
            Existing entitlement, active connection, API scopes and source
            policy are checked. Applicable context, trust checks and an active
            API key are still required at lookup time.
          </p>
          {impact.permitted.length ? (
            <ul className="mt-3">
              {impact.permitted.map((c) => (
                <li key={c.id}>
                  <Link
                    className="opryn-button-secondary inline-flex min-h-11 items-center px-3"
                    href={`/app/ai-connections/${c.id}`}
                  >
                    {c.name} →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm">
              No active external API connection currently permits this source
              under its configured policy.
            </p>
          )}
        </section>
        <section className="border-t border-[#d7e3f1] pt-6">
          <h2 className="text-xl font-semibold">Related knowledge</h2>
          <p className="mt-2 text-sm text-[#566279]">
            Recorded shared-process or replacement relationships, not inferred
            semantic dependencies.
          </p>
          <ul className="mt-3 divide-y divide-[#d7e3f1]">
            {impact.related.map((r) => (
              <li key={r.id} className="py-3">
                <Link
                  href={`/app/knowledge/${r.id}/impact`}
                  className="block break-words text-[#2855f9]"
                >
                  {r.content.slice(0, 180)} →
                </Link>
                <p className="mt-1 text-xs text-[#566279]">
                  v{r.current_version} ·{" "}
                  {r.approved ? "Approved" : "Not active"}
                </p>
              </li>
            ))}
          </ul>
          {!impact.related.length ? (
            <p className="mt-3 text-sm">
              No other knowledge linked through this process.
            </p>
          ) : null}
        </section>
        {source ? (
          <section className="rounded-3xl border border-[#d7e3f1] bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold">Source observation</h2>
            <p className="mt-3">
              {source.title} · {source.provider} ·{" "}
              {source.sync_status === "changed"
                ? "Update awaiting review"
                : source.sync_status}
            </p>
            <p className="mt-2 text-sm text-[#566279]">
              Version: {source.provider_version ?? "Not supplied"} · Last
              checked:{" "}
              {source.last_checked_at
                ? new Date(source.last_checked_at).toLocaleString("en-US")
                : "Not yet checked"}
            </p>
            {source.process_id &&
            source.process_id !== source.approved_process_id &&
            source.review_status !== "declined" ? (
              <Link
                className="opryn-action mt-4"
                href={`/app/processes/${source.process_id}?review=true`}
              >
                Review source findings
              </Link>
            ) : null}
            {source.previous_content && source.normalized_content ? (
              <details className="mt-5">
                <summary className="cursor-pointer font-semibold">
                  Compare previous and latest import
                </summary>
                <p className="mt-2 text-xs text-[#566279]">
                  Imported source text, not an automatically approved policy
                  comparison.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Previous import", source.previous_content],
                    ["Latest import", source.normalized_content],
                  ].map(([label, text]) => (
                    <div key={label}>
                      <h3 className="text-sm font-semibold">{label}</h3>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#fffcf7] p-3 font-sans text-sm leading-6">
                        {text}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </MotionRegion>
  );
}
