import Link from "next/link";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { getTeachNextGaps } from "@/lib/opryn/knowledge/health";

export default async function OprynWeekPage() {
  const context = await requireAdminContext();
  const service = await createClient();
  const organizationId = context.organization.id;
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const previous = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const end = now.toISOString();
  const questionCount = (start: string, finish: string) =>
    service
      .from("employee_questions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", start)
      .lt("created_at", finish);
  const [
    asked,
    answered,
    escalated,
    previousEscalated,
    apiAsked,
    apiAnswered,
    confirmations,
    conflicts,
    settings,
    next,
  ] = await Promise.all([
    questionCount(week, end),
    questionCount(week, end).eq("answered_by_opryn", true),
    questionCount(week, end).eq("escalated", true),
    questionCount(previous, week).eq("escalated", true),
    service
      .from("external_ai_activity")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("endpoint", "answer")
      .in("result_status", ["answered", "unknown"])
      .gte("created_at", week)
      .lt("created_at", end),
    service
      .from("external_ai_activity")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("endpoint", "answer")
      .eq("result_status", "answered")
      .gte("created_at", week)
      .lt("created_at", end),
    service
      .from("knowledge_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("event_type", "knowledge_confirmed")
      .gte("created_at", week)
      .lt("created_at", end),
    service
      .from("knowledge_conflicts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "resolved")
      .gte("resolved_at", week)
      .lt("resolved_at", end),
    service
      .from("organization_settings")
      .select("estimated_interruption_minutes")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    getTeachNextGaps(service, organizationId),
  ]);
  const error = [
    asked,
    answered,
    escalated,
    previousEscalated,
    apiAsked,
    apiAnswered,
    confirmations,
    conflicts,
    settings,
  ]
    .map((r) => r.error)
    .find(Boolean);
  if (error) throw error;
  const minutesPerAnswer = Number(
    settings.data?.estimated_interruption_minutes ?? 3,
  );
  // API requests are reported separately: automated volume is not automatically
  // equivalent to a human interruption avoided.
  const minutes = Math.round((answered.count ?? 0) * minutesPerAnswer);
  const previousCount = previousEscalated.count ?? 0;
  const difference = previousCount
    ? Math.round(
        (((escalated.count ?? 0) - previousCount) / previousCount) * 100,
      )
    : null;
  return (
    <div className="memory-page mx-auto max-w-4xl">
      <PageHeading
        eyebrow={context.organization.name}
        title="Your Opryn Week"
        description="A clear view of what Opryn handled, what reached a human, and what to teach next."
        actions={
          <Link href="/app" className="opryn-button-secondary px-4 py-3">
            Back to Home
          </Link>
        }
      />
      <p className="mb-5 text-sm text-[#657286]">
        Last 7 days · {new Date(week).toLocaleDateString("en-US")}–
        {now.toLocaleDateString("en-US")}
      </p>
      {(asked.count ?? 0) > 0 ? (
        <section className="memory-section rounded-3xl border border-[#dbe5f4] bg-[#f4f8ff] p-6 sm:p-9">
          <p className="font-semibold text-[#3158d8]">
            Estimated time returned
          </p>
          <p className="mt-4 text-5xl font-semibold tracking-tight">
            {Math.floor(minutes / 60)}h {minutes % 60}m
          </p>
          <p className="mt-4 text-sm leading-6 text-[#657286]">
            {answered.count} answers handled by Opryn × {minutesPerAnswer}{" "}
            minutes. This is an estimate, not measured working time.
          </p>
          <Link
            href="/app/settings"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#3158d8]"
          >
            Adjust interruption estimate →
          </Link>
        </section>
      ) : (
        <section className="rounded-3xl bg-[#f5f8fe] p-6">
          <h2 className="text-2xl font-semibold">
            Your next useful answer starts here.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#657286]">
            No team questions were recorded this week. Teach Opryn a repeat
            question, then let your team try it.
          </p>
          <Link className="opryn-action mt-5" href="/app/processes/new">
            Teach Opryn
          </Link>
        </section>
      )}
      <dl className="memory-section mt-7 divide-y divide-[#e1e6ee]">
        {[
          {
            title: "Questions handled",
            value: `${answered.count ?? 0} / ${asked.count ?? 0}`,
            detail: "Web, Slack, and MCP questions recorded in Opryn.",
          },
          {
            title: "Reached a human",
            value: String(escalated.count ?? 0),
            detail:
              difference === null
                ? "No previous-week baseline for comparison."
                : difference === 0
                  ? "Unchanged from the previous 7 days."
                  : `${Math.abs(difference)}% ${difference < 0 ? "fewer" : "more"} than the previous 7 days. Includes owners and experts.`,
          },
          {
            title: "Knowledge confirmed",
            value: String(confirmations.count ?? 0),
            detail: "Explicit Still Accurate confirmations recorded this week.",
          },
          {
            title: "Conflicts resolved",
            value: String(conflicts.count ?? 0),
            detail: "Review decisions saved to company memory.",
          },
          {
            title: "External AI API answers",
            value: `${apiAnswered.count ?? 0} / ${apiAsked.count ?? 0}`,
            detail:
              "API requests reported separately; not counted as human time returned.",
          },
        ].map((metric) => (
          <div
            key={metric.title}
            className="flex flex-wrap items-start justify-between gap-3 py-5"
          >
            <dt>
              <strong className="text-lg">{metric.title}</strong>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[#657286]">
                {metric.detail}
              </p>
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>
      {next[0] ? (
        <section className="memory-section mt-7 rounded-3xl border border-[#dfe5ed] bg-white p-6">
          <p className="text-xs font-semibold text-[#3158d8]">
            BEST THING TO TEACH NEXT
          </p>
          <h2 className="mt-3 text-2xl font-semibold">{next[0].topic}</h2>
          <p className="mt-2 text-sm text-[#657286]">
            {next[0].unresolved} unresolved questions in the last 30 days.
          </p>
          <Link
            href={`/app/processes/new?prompt=${encodeURIComponent(next[0].representative_question)}`}
            className="opryn-action mt-5"
          >
            Teach Opryn
          </Link>
        </section>
      ) : null}
      <Link
        href="/app/knowledge/health"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#3158d8]"
      >
        Review Knowledge Health →
      </Link>
    </div>
  );
}
