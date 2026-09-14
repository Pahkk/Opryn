import Link from "next/link";
import { redirect } from "next/navigation";
import { billingBoundary } from "@/lib/billing/access";
import { estimateReturnedTime } from "@/lib/answered-work";
import { KnowledgeHealthPreview } from "@/components/app/knowledge-health-preview";
import { getTeachNextGaps } from "@/lib/opryn/knowledge/health";
import { ArrowRight, BookOpenText, Check, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/app/page-heading";
import { LocalGreeting } from "@/components/app/local-greeting";
import { OprynStatus } from "@/components/opryn/opryn-status";
import {
  AskIcon,
  TeamIcon,
  type OprynIconProps,
} from "@/components/opryn-icons/opryn-icons";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { OwnerAnswer } from "@/components/app/owner-answer";
import { getNeedsYouItems, summarizeNeedsYou } from "@/lib/opryn/needs-you";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const context = await requireAppContext();
  const supabase = await createClient();
  if (await billingBoundary(supabase, context.organization.id)) {
    if (context.isAdmin) redirect("/onboarding?billing=required");
    return <section><h1>Your workspace needs an active plan.</h1><p>Ask a workspace owner to manage billing. Your company knowledge is preserved.</p></section>;
  }
  const firstName = context.user.fullName.split(" ")[0];
  const query = await searchParams;

  if (!context.isAdmin) {
    return <EmployeeHome firstName={firstName} context={context} />;
  }

  const organizationId = context.organization.id;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [
    answered,
    asked,
    questions,
    processReviews,
    callReviews,
    approvedProcesses,
    recentQuestions,
    recentProcesses,
    recommendation,
    channelQuestions,
    onboardingStatus,
    approvedKnowledge,
    successfulAnswer,
    externalLearning,
    learningSession,
    needsYouItems,
  ] = await Promise.all([
    supabase
      .from("employee_questions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("answered_by_opryn", true)
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("employee_questions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("employee_questions")
      .select("id,question,created_at")
      .eq("organization_id", organizationId)
      .eq("status", "needs_owner")
      .order("created_at", { ascending: false }),
    supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "needs_review"),
    supabase
      .from("call_findings")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "observed"),
    supabase
      .from("processes")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "approved"),
    supabase
      .from("employee_questions")
      .select("id,question,status,created_at,answered_by_opryn,resolved_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("processes")
      .select("id,title,status,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("process_recommendations")
      .select("id,title,reason")
      .eq("organization_id", organizationId)
      .eq("status", "recommended")
      .order("priority")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("employee_questions")
      .select("origin")
      .eq("organization_id", organizationId)
      .eq("answered_by_opryn", true)
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("organization_onboarding")
      .select(
        "onboarding_complete,checklist_hidden,current_step,knowledge_locations,first_knowledge_id,first_test_answered,team_invited",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("knowledge_chunks")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("approved", true)
      .limit(1),
    supabase
      .from("employee_questions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("answered_by_opryn", true)
      .eq("status", "answered")
      .limit(1),
    supabase
      .from("external_learning_jobs")
      .select("id,name,client_kind,status,result_summary,process_id,updated_at")
      .eq("organization_id", organizationId)
      .in("status", [
        "received",
        "processing",
        "extracting",
        "organizing",
        "needs_review",
      ])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("onboarding_learning_sessions")
      .select("intent")
      .eq("organization_id", organizationId)
      .eq("user_id", context.user.id)
      .maybeSingle(),
    getNeedsYouItems({
      service: supabase,
      organizationId,
      userId: context.user.id,
      isAdmin: true,
    }),
  ]);

  // Shared records include web, ChatGPT, Claude, and other supported surfaces.
  // Do not require a particular onboarding form or learning source.
  const hasApprovedKnowledge = Boolean(approvedKnowledge.data?.length);
  const hasSuccessfulAnswer = Boolean(successfulAnswer.data?.length);

  const unfinishedSetup = onboardingStatus.data && !onboardingStatus.data.onboarding_complete && !(hasApprovedKnowledge && hasSuccessfulAnswer);

  const [
    repeatedClusters,
    settings,
    estimateQuestions,
    teamMembers,
    negativeFeedback,
  ] = await Promise.all([
    getTeachNextGaps(supabase, organizationId),
    supabase
      .from("organization_settings")
      .select("estimated_interruption_minutes")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("employee_questions")
      .select(
        "id,asked_by,question,origin,status,answered_by_opryn,escalated,created_at",
      )
      .eq("organization_id", organizationId)
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("permission_level", "employee"),
    supabase
      .from("knowledge_feedback")
      .select("question_id")
      .eq("organization_id", organizationId)
      .eq("feedback_type", "not_right"),
  ]);
  if (
    answered.error ||
    asked.error ||
    recentQuestions.error ||
    estimateQuestions.error ||
    teamMembers.error ||
    negativeFeedback.error
  )
    throw new Error("Your activity could not be loaded. Please try again.");
  const estimate = estimateReturnedTime(
    estimateQuestions.data ?? [],
    new Set((teamMembers.data ?? []).map((m) => m.user_id)),
    new Set((negativeFeedback.data ?? []).map((f) => f.question_id)),
    Number(settings.data?.estimated_interruption_minutes ?? 3),
  );
  const answeredCount = answered.count ?? 0;
  const askedCount = asked.count ?? 0;
  const waitingQuestions = questions.data?.length ?? 0;
  const needsYou = needsYouItems.length;
  const needsYouSummary = summarizeNeedsYou(needsYouItems);
  const handledRate = askedCount
    ? Math.round((answeredCount / askedCount) * 100)
    : 0;
  const repeated = repeatedClusters[0];
  const teachNext = repeated
    ? {
        id: null,
        title: repeated.topic,
        reason: `${repeated.questions} related questions in the last 30 days. ${repeated.unresolved} still need an answer; ${repeated.escalations} reached a human.${repeated.estimatedMinutes ? ` Estimated interruption time: ${formatMinutes(repeated.estimatedMinutes)}.` : ""}`,
        prompt: repeated.representative_question,
      }
    : recommendation.data
      ? { ...recommendation.data, prompt: null }
      : {
          id: null,
          title:
            waitingQuestions > 0
              ? questions.data?.[0]?.question ||
                "A question your team keeps asking"
              : approvedProcesses.count
                ? "The next task only you know how to do"
                : "Your first repeatable process",
          reason:
            waitingQuestions > 0
              ? "Your team asked about this and Opryn could not find an approved answer."
              : "Start with one task you want someone else to handle without asking you.",
          prompt: null,
        };
  const teachHref = teachNext.id
    ? `/app/processes/new?recommendation=${teachNext.id}`
    : teachNext.prompt
      ? `/app/processes/new?prompt=${encodeURIComponent(teachNext.prompt)}`
      : "/app/processes/new";
  const estimatedMinutes = estimate.minutes;
  const channelCounts = (channelQuestions.data ?? []).reduce(
    (counts, item) => {
      const key: "web" | "slack" | "teams" | "external_ai" =
        item.origin === "slack" ||
        item.origin === "teams" ||
        item.origin === "external_ai"
          ? item.origin
          : "web";
      counts[key] += 1;
      return counts;
    },
    { web: 0, slack: 0, teams: 0, external_ai: 0 },
  );

  const activity = [
    ...(recentQuestions.data ?? []).map((item) => ({
      id: `q-${item.id}`,
      label:
        item.status === "needs_owner"
          ? `A teammate needs help with “${item.question}”`
          : item.answered_by_opryn
            ? `Opryn answered “${item.question}”`
            : `A person answered “${item.question}”`,
      date: item.created_at,
      kind: item.status === "needs_owner" ? "needs" : "answered",
    })),
    ...(recentProcesses.data ?? []).map((item) => ({
      id: `p-${item.id}`,
      label: `${item.title} was ${item.status === "approved" ? "approved" : "added for review"}`,
      date: item.created_at,
      kind: "knowledge",
    })),
  ]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 4);
  const handledActivity = (recentQuestions.data ?? []).filter(
    (item) => item.status === "answered" && item.answered_by_opryn,
  );
  const primaryNeed =
    questions.data?.find((item) => item.id === query.question) ??
    questions.data?.[0];

  return (
    <div className="home-dashboard space-y-7 sm:space-y-9">
      {externalLearning.data ? (
        <ExternalLearningBanner learning={externalLearning.data} />
      ) : null}
      <header className="home-reveal flex flex-col gap-6 pt-2 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl lg:flex-1">
          <p className="opryn-page-kicker">{context.organization.name}</p>
          <LocalGreeting name={firstName} />
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--opryn-muted)]">
            {unfinishedSetup ? learningSession.data?.intent ? "Your learning request is saved. Continue when you're ready." : "Start with one source. Review what matters, then ask your first question." : "See what Opryn handled, what needs a decision, and what to teach next."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--opryn-muted)]">
          <span className="font-semibold text-[var(--opryn-navy)]">
            {handledRate}% handled
          </span>
          <span
            aria-hidden="true"
            className="h-4 w-px bg-[var(--opryn-line)]"
          />
          <span>{needsYou} need your input</span>
        </div>
      </header>

      <section className="home-reveal home-time-module overflow-hidden rounded-[26px] border border-[#d7e5fa] bg-[#eef5ff] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <p className="home-metric-label text-sm font-semibold text-[var(--opryn-blue)]">
              {estimate.count
                ? "Estimated time returned"
                : "Ready for your team's questions"}
            </p>
            <p className="home-metric-value mt-4 text-[clamp(3.5rem,9vw,6.8rem)] font-semibold leading-none tracking-[-.075em] text-[var(--opryn-navy)]">
              {estimate.count
                ? formatMinutes(estimatedMinutes)
                : "Your next step"}
            </p>
            <p className="mt-5 max-w-lg text-sm leading-6 text-[#596b84]">
              {estimate.count
                ? `Based on ${estimate.count} eligible team questions this week.`
                : "Invite someone to ask about your approved knowledge. Time estimates appear after eligible team use."}
            </p>
            <details className="mt-3 max-w-lg text-sm leading-6 text-[#596b84]">
              <summary className="cursor-pointer font-semibold">
                How this estimate works
              </summary>
              <p className="mt-2">
                Eligible answered team questions × {estimate.minutesPerQuestion}{" "}
                minutes (your workspace setting). Excludes owner/admin
                questions, AI-agent calls, escalations, negative feedback, and
                the same person&apos;s repeated text on one day. Based on the
                latest 1,000 questions this week. An estimate of potential time
                returned, not confirmed interruptions avoided.
              </p>
              <Link
                href="/app/settings"
                className="underline underline-offset-4"
              >
                Change the estimate
              </Link>
            </details>
          </div>
          <div className="lg:pb-2">
            <div className="flex items-end justify-between gap-4">
              <span className="text-xs font-medium text-[#61738c]">
                Questions answered by Opryn
              </span>
              <strong className="text-2xl tracking-[-.04em] text-[var(--opryn-navy)]">
                {handledRate}%
              </strong>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white/85"
              aria-label={`${handledRate}% of questions handled`}
            >
              <span
                className="home-progress-fill block h-full rounded-full bg-[var(--opryn-blue)]"
                style={
                  {
                    "--home-progress": `${handledRate}%`,
                  } as React.CSSProperties
                }
              />
            </div>
            <p className="mt-4 text-xs leading-5 text-[#718096]">
              {askedCount
                ? `${answeredCount} of ${askedCount} questions were handled from approved company knowledge.`
                : "Once your team starts asking, Opryn will show the time it gives back."}
            </p>
          </div>
        </div>
      </section>

      <section className="home-reveal">
        <p className="opryn-section-label">QUICK START</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
          What would you like to do?
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href="/app/processes/new"
            icon={BookOpenText}
            label="Teach Opryn"
          />
          <QuickAction href="/app/ask" icon={AskIcon} label="Ask Opryn" />
          <QuickAction
            href="/app/team"
            icon={TeamIcon}
            label="Invite teammate"
          />
          <QuickAction
            href="/app/processes"
            icon={BookOpenText}
            label="Open knowledge"
          />
        </div>
      </section>

      <div className="home-reveal grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <section className="overflow-hidden rounded-[24px] border border-[var(--opryn-line)] bg-white shadow-[var(--opryn-shadow-sm)]">
          <div className="flex items-end justify-between gap-4 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
            <div>
              <p className="opryn-section-label">HANDLED FOR YOU</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[var(--opryn-navy)]">
                {answeredCount} questions handled
              </h2>
              <p className="mt-2 text-sm text-[var(--opryn-muted)]">
                Answered from approved knowledge. Answered does not mean
                confirmed resolved.
              </p>
            </div>
            <OprynStatus kind="approved" label="Handled" />
          </div>
          {handledActivity.length ? (
            <div className="border-t border-[var(--opryn-line)] px-6 sm:px-8">
              {handledActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 border-b border-[var(--opryn-line)] py-4 last:border-0"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#edf4ff] text-[var(--opryn-blue)]">
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--opryn-navy)]">
                      {item.question}
                    </p>
                    <p className="mt-1 text-xs text-[var(--opryn-muted)]">
                      Answered by Opryn
                    </p>
                  </div>
                  <time className="hidden text-xs text-[var(--opryn-faint)] sm:block">
                    {new Date(item.created_at).toLocaleDateString()}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Clock3 />}
              title="Nothing handled yet."
              description="When your team asks Opryn, the questions it handles will appear here."
            />
          )}
          <div className="border-t border-[var(--opryn-line)] px-6 py-4 sm:px-8">
            <Link
              href="/app/ask"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-[var(--opryn-blue)]"
            >
              Open Ask Opryn
              <ArrowRight className="size-4 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <section
          id="needs-you"
          className={`overflow-hidden rounded-[24px] border bg-white shadow-[var(--opryn-shadow-sm)] ${needsYou ? "border-[#efd6d8]" : "border-[var(--opryn-line)]"}`}
        >
          <div className="p-6 sm:p-8">
            <p className="opryn-section-label text-[var(--opryn-coral)]">
              NEEDS YOU
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-5xl font-semibold tracking-[-.065em] text-[var(--opryn-navy)]">
                {needsYou}
              </p>
              <span className="text-xs font-medium text-[var(--opryn-muted)]">
                items
              </span>
            </div>
            {primaryNeed ? (
              <div className="mt-6 border-l-2 border-[#e5a7ac] pl-4">
                <p className="text-xs font-semibold text-[var(--opryn-coral)]">
                  Answer needed
                </p>
                <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-[var(--opryn-navy)]">
                  {primaryNeed.question}
                </p>
                <OwnerAnswer questionId={primaryNeed.id} />
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-[var(--opryn-muted)]">
                {needsYou
                  ? "A few reviews will make Opryn more useful everywhere."
                  : "Opryn doesn’t need anything from you right now."}
              </p>
            )}
            {needsYou ? (
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--opryn-muted)]">
                {needsYouSummary.answer ? (
                  <span>{needsYouSummary.answer} need an answer</span>
                ) : null}
                {needsYouSummary.approve ? (
                  <span>{needsYouSummary.approve} approvals</span>
                ) : null}
                {needsYouSummary.conflict ? (
                  <span>{needsYouSummary.conflict} conflicts</span>
                ) : null}
                {needsYouSummary.update ? (
                  <span>{needsYouSummary.update} updates</span>
                ) : null}
              </div>
            ) : null}
          </div>
          {needsYou ? (
            <Link
              href="/app/needs-you"
              className="group flex min-h-14 items-center justify-between border-t border-[var(--opryn-line)] px-6 text-sm font-semibold text-[var(--opryn-blue)] hover:bg-[#f7faff] sm:px-8"
            >
              Review what needs you
              <ArrowRight className="size-4 group-hover:translate-x-0.5" />
            </Link>
          ) : null}
        </section>
      </div>

      <section className="home-reveal grid overflow-hidden rounded-[26px] border border-[#d8e5f6] bg-white shadow-[var(--opryn-shadow-sm)] lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="opryn-section-label text-[var(--opryn-blue)]">
            TEACH NEXT
          </p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-[-.045em] text-[var(--opryn-navy)]">
            {teachNext.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--opryn-muted)]">
            {teachNext.reason}
          </p>
          <Link href={teachHref} className="opryn-action mt-6">
            Teach Opryn <ArrowRight className="size-4" />
          </Link>
        </div>
        <div
          className="border-t border-[var(--opryn-line)] bg-[#f6f9fd] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10"
          id="insights"
        >
          <p className="opryn-section-label">LEARNING PROGRESS</p>
          <div className="mt-6 space-y-5">
            <HomeInsight
              label="Handled without you"
              value={`${handledRate}%`}
            />
            <HomeInsight
              label="Approved processes"
              value={approvedProcesses.count ?? 0}
            />
            <HomeInsight
              label="Needs review"
              value={(processReviews.count ?? 0) + (callReviews.count ?? 0)}
            />
          </div>
          <p className="mt-6 border-t border-[var(--opryn-line)] pt-4 text-xs leading-5 text-[var(--opryn-muted)]">
            This week · Web {channelCounts.web} · Slack {channelCounts.slack} ·
            AI connections {channelCounts.external_ai}
          </p>
        </div>
      </section>

      <KnowledgeHealthPreview organizationId={organizationId} />
      {activity.length ? (
        <section className="home-reveal border-t border-[var(--opryn-line)] pt-7">
          <p className="opryn-section-label">RECENT ACTIVITY</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
            What changed lately
          </h2>
          <div className="mt-4 divide-y divide-[var(--opryn-line)] border-y border-[var(--opryn-line)]">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center gap-4 py-4">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#8db6f7]" />
                <p className="min-w-0 flex-1 text-sm text-[#46566d]">
                  {item.label}
                </p>
                <time className="hidden text-xs text-[var(--opryn-faint)] sm:block">
                  {new Date(item.date).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EmployeeHome({
  firstName,
  context,
}: {
  firstName: string;
  context: Awaited<ReturnType<typeof requireAppContext>>;
}) {
  return (
    <>
      <header className="home-reveal pb-2 pt-2">
        <p className="opryn-page-kicker">{context.organization.name}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-.055em] text-[var(--opryn-navy)]">
          Hi {firstName}, what do you need help with?
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--opryn-muted)]">
          Ask a company question or browse the knowledge your team has approved.
        </p>
      </header>
      <Link
        href="/app/ask"
        className="home-reveal group flex min-h-52 items-center justify-between overflow-hidden rounded-[26px] border border-[#d7e5fa] bg-[#eef5ff] p-6 shadow-[var(--opryn-shadow-sm)] sm:p-9"
      >
        <div>
          <p className="text-xs font-semibold text-[var(--opryn-blue)]">
            Company help
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.05em] text-[var(--opryn-navy)]">
            Ask Opryn
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--opryn-muted)]">
            Get a clear answer from your company&apos;s approved knowledge.
          </p>
        </div>
        <span className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-[var(--opryn-blue)] text-white shadow-[0_8px_22px_rgba(20,107,255,.18)] group-hover:translate-x-1">
          <ArrowRight className="size-5" />
        </span>
      </Link>
      <div className="home-reveal mt-6 grid gap-3 sm:grid-cols-2">
        <QuickAction
          href="/app/processes"
          icon={BookOpenText}
          label="Browse company knowledge"
        />
        <QuickAction href="/app/team" icon={TeamIcon} label="View the team" />
      </div>
    </>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ComponentType<OprynIconProps>;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[82px] items-center gap-3 rounded-[18px] border border-[var(--opryn-line)] bg-white px-5 text-sm font-semibold text-[#354156] shadow-[0_8px_24px_rgba(7,27,61,.035)] hover:-translate-y-0.5 hover:border-[#c9d9f0] hover:shadow-[0_12px_30px_rgba(7,27,61,.07)]"
    >
      <Icon size={19} className="shrink-0 text-[var(--opryn-blue)]" />
      {label}
      {badge ? (
        <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-[var(--opryn-coral-surface)] px-1.5 py-1 text-[10px] font-bold text-[var(--opryn-coral)]">
          {badge}
        </span>
      ) : (
        <ArrowRight className="ml-auto size-4 text-[#9aa4b2] group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}

function HomeInsight({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-end justify-between gap-5 border-b border-[var(--opryn-line)] pb-5 last:border-0 last:pb-0">
      <span className="text-sm text-[var(--opryn-muted)]">{label}</span>
      <strong className="text-2xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)]">
        {value}
      </strong>
    </div>
  );
}

function ExternalLearningBanner({
  learning,
}: {
  learning: {
    id: string;
    name: string;
    client_kind: string;
    status: string;
    result_summary: unknown;
    process_id: string | null;
    updated_at: string;
  };
}) {
  const provider =
    learning.client_kind === "chatgpt"
      ? "ChatGPT"
      : learning.client_kind === "claude"
        ? "Claude"
        : "an AI connection";
  const ready = learning.status === "needs_review";
  const summary = (learning.result_summary || {}) as {
    processes?: number;
    rules?: number;
    faqs?: number;
    clarifications?: number;
    suggested_questions?: string[];
  };
  // Completed jobs are historical activity, not unfinished Home actions.
  // Keep this guard even though the dashboard query already excludes them.
  if (["complete", "failed"].includes(learning.status)) return null;
  return (
    <section className="home-reveal overflow-hidden rounded-[22px] border border-[#cfe0f7] bg-[#f1f7ff] sm:flex sm:items-center sm:justify-between">
      <div className="p-5 sm:p-6">
        <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--opryn-blue)]">
          {ready ? "New knowledge ready" : `Learning from ${provider}`}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-.025em] text-[var(--opryn-navy)]">
          {ready
            ? `${provider} taught Opryn about ${learning.name}.`
            : `Opryn is organizing ${learning.name}.`}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--opryn-muted)]">
          {ready
            ? [
                summary.processes ? `${summary.processes} processes` : null,
                summary.rules ? `${summary.rules} possible rules` : null,
                summary.faqs ? `${summary.faqs} common answers` : null,
                summary.clarifications
                  ? `${summary.clarifications} need clarification`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Important findings are ready for review."
            : "You can keep using Opryn. We’ll let you know when the review is ready."}
        </p>
      </div>
      {ready && learning.process_id ? (
        <Link
          href={`/app/processes/${learning.process_id}`}
          className="group flex min-h-14 shrink-0 items-center justify-between gap-4 border-t border-[#cfe0f7] px-5 text-sm font-bold text-[var(--opryn-blue)] sm:min-h-full sm:self-stretch sm:border-l sm:border-t-0 sm:px-6"
        >
          Review <ArrowRight className="size-4 group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <div className="mx-5 mb-5 h-1.5 overflow-hidden rounded-full bg-[#d7e6f8] sm:mx-6 sm:mb-0 sm:w-28">
          <span className="opryn-learning-progress block h-full w-2/3 rounded-full bg-[var(--opryn-blue)]" />
        </div>
      )}
    </section>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
