import Link from "next/link";
import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/app/page-heading";
import { InboxAction } from "@/components/app/learning-inbox-actions";
import { getKnowledgeHealth } from "@/lib/opryn/knowledge/health";

const linkStyle =
  "inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-[#3158d8] hover:bg-[#edf3ff] focus-visible:outline-2 focus-visible:outline-[#3158d8]";
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="memory-section scroll-mt-24 border-t border-[#e0e5ec] py-7 sm:py-9"
    >
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657286]">
        {description}
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-[#f6f8fb] p-5 text-sm leading-6 text-[#657286]">
      {children}
    </p>
  );
}

export default async function KnowledgeHealthPage() {
  const context = await requireAdminContext();
  const service = await createClient();
  const health = await getKnowledgeHealth(service, context.organization.id);
  return (
    <div className="memory-page min-w-0">
      <PageHeading
        eyebrow="Company memory"
        title="Knowledge Health"
        description="Know what your team can rely on—and what needs a little care."
        actions={
          <Link href="/app/processes" className={linkStyle}>
            Back to Knowledge
          </Link>
        }
      />
      <div className="memory-section rounded-3xl border border-[#dfe6f0] bg-[#f5f8fe] p-5 sm:p-8">
        <p className="text-sm font-semibold text-[#3158d8]">
          No mystery score. Just the facts.
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          {health.approvedCount
            ? `${health.approvedCount} approved knowledge entries.`
            : "Your company memory starts here."}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657286]">
          {health.approvedCount
            ? "Coverage reflects recorded sources, review dates, conflicts, and assigned experts. An entry is a searchable piece of knowledge—not necessarily a whole process."
            : "Show Opryn a useful document or explain something your team asks you often. Review it, then try your first question."}
        </p>
        {health.recent.asked > 0 ? (
          <p className="mt-4 text-sm">
            <strong>
              {health.recent.answered} of {health.recent.asked}
            </strong>{" "}
            questions answered by Opryn in the last 30 days ·{" "}
            <strong>{health.recent.escalated}</strong> escalated to a human.
          </p>
        ) : null}
        {!health.approvedCount ? (
          <Link href="/app/processes/new" className="opryn-action mt-5">
            Start Learning
          </Link>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-[#657286]">
          Question totals here include Web, Slack, and MCP questions recorded in
          Opryn. External API activity is reported separately. Age-based reviews
          are reminders, not proof that a policy is wrong.
        </p>
      </div>
      {health.limited ? (
        <p role="status" className="my-4 rounded-xl bg-[#fff3e8] p-4 text-sm">
          This workspace has a large history. This view uses up to 5,000 recent
          records per dataset; counts are a partial view, not organization
          totals.
        </p>
      ) : null}
      <nav
        aria-label="Knowledge health sections"
        className="my-5 flex flex-wrap gap-1"
      >
        {[
          "Coverage",
          "Gaps",
          "Conflicts",
          "Freshness",
          "Key Person Risk",
          "Most Used",
        ].map((name) => (
          <a
            key={name}
            className={linkStyle}
            href={`#${name.toLowerCase().replaceAll(" ", "-")}`}
          >
            {name}
          </a>
        ))}
      </nav>
      <Section
        id="coverage"
        title="Coverage"
        description="Your actual processes and company guidance. Healthy means no recorded conflict or overdue review; it does not mean Opryn knows everything about the area."
      >
        {health.areas.length ? (
          <div className="divide-y divide-[#e5e9ef]">
            {health.areas.map((area) => (
              <div
                key={area.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold break-words">{area.title}</h3>
                  <p className="mt-1 text-sm text-[#657286]">
                    {area.approved} approved entries · {area.conflicts}{" "}
                    conflicting · {area.reviews} to review
                  </p>
                </div>
                <Link
                  className={linkStyle}
                  href={
                    area.conflicts
                      ? "/app/needs-you?filter=conflict"
                      : area.reviews
                        ? "#freshness"
                        : area.href
                  }
                >
                  {area.conflicts
                    ? "Resolve conflict"
                    : area.reviews
                      ? "Needs review"
                      : "Healthy · View"}
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <Empty>
            No approved coverage yet. Your first reviewed source will appear
            here.
          </Empty>
        )}
      </Section>
      <Section
        id="gaps"
        title="Best things to teach next"
        description="Existing question clusters, ranked by recent unresolved questions, human escalations, people affected, and recency. Counts below cover the last 30 days."
      >
        {health.gaps.length ? (
          health.gaps.slice(0, 12).map((gap, index) => (
            <article
              key={gap.id}
              className={`mb-3 rounded-2xl border p-5 ${index === 0 ? "border-[#cbd9f4] bg-[#f5f8ff]" : "border-[#e0e5ec] bg-white"}`}
            >
              <p className="text-xs font-semibold text-[#3158d8]">
                {index === 0 ? "Best thing to teach next" : "Knowledge gap"}
              </p>
              <h3 className="mt-2 text-xl font-semibold">{gap.topic}</h3>
              <p className="mt-2 text-sm leading-6 text-[#657286]">
                {gap.questions} questions · {gap.unresolved} still unanswered ·{" "}
                {gap.escalations} reached a human · {gap.people} people
              </p>
              <p className="mt-2 text-xs text-[#657286]">
                {Object.entries(gap.channels)
                  .map(
                    ([channel, count]) =>
                      `${({ employee: "Web", mcp_chatgpt: "ChatGPT", mcp_claude: "Claude", external_ai: "AI", slack: "Slack", teams: "Teams" } as Record<string, string>)[channel] || "Other"}: ${count}`,
                  )
                  .join(" · ")}
              </p>
              {gap.estimatedMinutes > 0 ? (
                <p className="mt-2 text-sm">
                  Estimated interruption time: {gap.estimatedMinutes} minutes,
                  using {health.interruptionMinutes} minutes per escalation.
                </p>
              ) : null}
              <Link
                className={`${linkStyle} mt-3`}
                href={`/app/processes/new?prompt=${encodeURIComponent(gap.representative_question)}`}
              >
                Teach Opryn once →
              </Link>
            </article>
          ))
        ) : (
          <Empty>
            No unresolved question clusters in the last 30 days. This is based
            on recorded questions, not assumed company coverage.
          </Empty>
        )}
      </Section>
      <Section
        id="conflicts"
        title="Conflicts"
        description="Opryn will not choose between contradictory policies. Review the evidence and decide what should remain official."
      >
        {health.conflicts.length ? (
          health.conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9ef] py-4"
            >
              <p className="max-w-2xl text-sm leading-6">
                {conflict.explanation || "Two company sources disagree."}
              </p>
              <Link
                className={linkStyle}
                href={`/app/needs-you?item=conflict-${conflict.id}`}
              >
                Resolve
              </Link>
            </div>
          ))
        ) : (
          <Empty>No recorded unresolved conflicts.</Empty>
        )}
      </Section>
      <Section
        id="freshness"
        title="Still accurate?"
        description="Critical knowledge is due for confirmation after 90 days; other knowledge after 180 days. Recorded source changes and manual review flags also appear here."
      >
        {health.freshness.length ? (
          health.freshness.slice(0, 20).map((item) => (
            <article
              data-inbox-card
              key={item.id}
              className="mb-3 rounded-2xl border border-[#e0e5ec] bg-white p-5"
            >
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6">
                {item.content}
              </p>
              <p className="mt-3 text-xs text-[#657286]">
                {item.reason} ·{" "}
                {item.last_confirmed_at
                  ? `Last confirmed ${new Date(item.last_confirmed_at).toLocaleDateString("en-US")}`
                  : "Not yet confirmed"}{" "}
                · Version {item.current_version}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <InboxAction
                  primary
                  action={{
                    action: "confirm_knowledge",
                    knowledgeId: item.id,
                    version: item.current_version,
                  }}
                >
                  Still Accurate
                </InboxAction>
                <Link
                  className={linkStyle}
                  href={`/app/knowledge/${item.id}/history`}
                >
                  Review source & history
                </Link>
              </div>
            </article>
          ))
        ) : (
          <Empty>No knowledge is currently due for confirmation.</Empty>
        )}
        {health.freshness.length > 20 ? (
          <Link className={linkStyle} href="/app/needs-you?filter=update">
            More freshness reviews →
          </Link>
        ) : null}
      </Section>
      <Section
        id="key-person-risk"
        title="Protect knowledge that depends on one person"
        description="These areas have only one currently assigned expert. This shows recorded responsibility—not employee monitoring or a claim that nobody else knows the answer."
      >
        {health.keyPersonRisks.length ? (
          health.keyPersonRisks.map((area) => (
            <div
              key={area.title}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9ef] py-4"
            >
              <div>
                <h3 className="font-semibold">{area.title}</h3>
                <p className="mt-1 text-sm text-[#657286]">
                  {area.name} is the only assigned expert.
                </p>
              </div>
              <div className="flex flex-wrap">
                <Link
                  className={linkStyle}
                  href={`/app/processes/new?prompt=${encodeURIComponent(`Capture company knowledge about ${area.title} with ${area.name}.`)}`}
                >
                  Capture knowledge
                </Link>
                <Link className={linkStyle} href="/app/team">
                  Assign backup
                </Link>
              </div>
            </div>
          ))
        ) : (
          <Empty>
            No single-expert areas found among current assignments.{" "}
            <Link href="/app/team" className="font-semibold text-[#3158d8]">
              Review company experts
            </Link>
            .
          </Empty>
        )}
      </Section>
      <Section
        id="most-used"
        title="Most used knowledge"
        description="Lifetime recorded source uses. These counts are usage events, not distinct people or estimated money saved."
      >
        {health.mostUsed.length ? (
          health.mostUsed.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9ef] py-4"
            >
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-[#657286]">
                  {item.usage_count} source uses · Version{" "}
                  {item.current_version}
                </p>
              </div>
              <Link
                className={linkStyle}
                href={`/app/knowledge/${item.id}/history`}
              >
                View knowledge
              </Link>
            </div>
          ))
        ) : (
          <Empty>
            As Opryn answers real questions, the sources it uses will appear
            here.
          </Empty>
        )}
      </Section>
      <Link href="/app/knowledge/week" className={linkStyle}>
        View your Opryn week →
      </Link>
    </div>
  );
}
