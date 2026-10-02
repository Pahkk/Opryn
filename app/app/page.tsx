import { trainingTeachNext } from "@/lib/training/teach-next";
import { HomeTraining } from "@/components/training/home-training";
import Link from "next/link";
import { redirect } from "next/navigation";
import { billingBoundary } from "@/lib/billing/access";
import { estimateReturnedTime } from "@/lib/answered-work";
import { KnowledgeHealthPreview } from "@/components/app/knowledge-health-preview";
import { getTeachNextGaps } from "@/lib/opryn/knowledge/health";
import { ArrowRight, BookOpenText } from "lucide-react";
import { OwnerHome } from "@/components/app/owner-home";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import {
  TeamIcon,
  type OprynIconProps,
} from "@/components/opryn-icons/opryn-icons";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { getNeedsYouItems } from "@/lib/opryn/needs-you";
import { getOwnerIntelligence } from "@/lib/opryn/owner-intelligence";
import { OwnerIntelligencePanel } from "@/components/app/owner-intelligence";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>;
}) {
  const context = await requireAppContext();
  const supabase = await createClient();
  if (await billingBoundary(supabase, context.organization.id)) {
    if (context.isAdmin) redirect("/onboarding?billing=required");
    return (
      <section>
        <h1>Your workspace needs an active plan.</h1>
        <p>
          Ask a workspace owner to manage billing. Your company knowledge is
          preserved.
        </p>
      </section>
    );
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
    needsYouItems,
    intelligence,
    handledQuestions,
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
      .select(
        "id,question,status,created_at,answered_by_opryn,resolved_at,origin",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
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
    getNeedsYouItems({
      service: supabase,
      organizationId,
      userId: context.user.id,
      isAdmin: true,
    }),
    getOwnerIntelligence(supabase, organizationId),
    supabase
      .from("employee_questions")
      .select("id,question,created_at,origin")
      .eq("organization_id", organizationId)
      .eq("status", "answered")
      .eq("answered_by_opryn", true)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Shared records include web, ChatGPT, Claude, and other supported surfaces.
  // Do not require a particular onboarding form or learning source.
  const hasApprovedKnowledge = Boolean(approvedKnowledge.data?.length);
  const hasSuccessfulAnswer = Boolean(successfulAnswer.data?.length);

  const unfinishedSetup =
    onboardingStatus.data &&
    !onboardingStatus.data.onboarding_complete &&
    !(hasApprovedKnowledge && hasSuccessfulAnswer);

  const [
    repeatedClusters,
    settings,
    estimateQuestions,
    teamMembers,
    negativeFeedback,
    trainingSignal,
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
    trainingTeachNext(supabase, organizationId),
  ]);
  if (
    answered.error ||
    asked.error ||
    recentQuestions.error ||
    estimateQuestions.error ||
    teamMembers.error ||
    negativeFeedback.error ||
    handledQuestions.error
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
  const handledRate = askedCount
    ? Math.round((answeredCount / askedCount) * 100)
    : 0;
  const repeated = repeatedClusters[0];
  const teachNext = trainingSignal
    ? {
        id: null,
        title: trainingSignal.title,
        reason: trainingSignal.reason,
        prompt: trainingSignal.question,
      }
    : intelligence.recommendation
      ? {
          id: null,
          title: intelligence.recommendation.title,
          reason: intelligence.recommendation.reason,
          prompt: intelligence.recommendation.question ?? null,
        }
      : repeated
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
  const teachHref =
    trainingSignal?.href ??
    intelligence.recommendation?.href ??
    (teachNext.id
      ? `/app/processes/new?recommendation=${teachNext.id}`
      : teachNext.prompt
        ? `/app/processes/new?prompt=${encodeURIComponent(teachNext.prompt)}`
        : "/app/processes/new");
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
  const handledActivity = handledQuestions.data ?? [];
  const reviewCount = needsYouItems.filter(
    (item) => item.kind === "approve",
  ).length;

  return (
    <OwnerHome
      name={firstName}
      organizationName={context.organization.name}
      handledCount={answeredCount}
      hasApprovedKnowledge={hasApprovedKnowledge}
      gapCount={intelligence.openGaps}
      items={needsYouItems}
      initialQuestionId={query.question}
      teach={{
        title: teachNext.title,
        reason: teachNext.reason,
        href: teachHref,
        action: intelligence.recommendation?.action ?? "Teach Opryn",
      }}
      handled={handledActivity}
      recentKnowledge={recentProcesses.data ?? []}
      health={
        <KnowledgeHealthPreview
          organizationId={organizationId}
          compact
          reviewCount={reviewCount}
          freshnessCount={
            needsYouItems.filter((item) => item.type === "freshness").length
          }
        />
      }
      intelligence={
        <>
          <HomeTraining organizationId={organizationId} />
          <OwnerIntelligencePanel data={intelligence} />
          <p className="text-xs text-[var(--opryn-muted)]">
            This week: {askedCount} questions · {handledRate}% answered by Opryn
            ·{" "}
            {estimate.count
              ? `${formatMinutes(estimatedMinutes)} estimated time returned`
              : "No eligible time estimate yet"}
            . Web {channelCounts.web} · Slack {channelCounts.slack} · Teams{" "}
            {channelCounts.teams} · AI {channelCounts.external_ai}.
          </p>
          <details className="mt-4 text-xs">
            <summary>Recent workspace changes</summary>
            <p className="py-2">
              {approvedProcesses.count ?? 0} approved processes ·{" "}
              {processReviews.count ?? 0} processes and {callReviews.count ?? 0}{" "}
              call findings waiting for review.
            </p>
            {activity.map((item) => (
              <p className="py-2" key={item.id}>
                {item.label}
              </p>
            ))}
          </details>
        </>
      }
      learning={
        externalLearning.data ? (
          <ExternalLearningBanner learning={externalLearning.data} />
        ) : null
      }
      setupHref={unfinishedSetup ? "/onboarding" : undefined}
    />
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
        <QuickAction
          href="/app/training?view=mine"
          icon={TeamIcon}
          label="What you need to know"
        />
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
      className="home-quick-action group flex min-h-[82px] items-center gap-3 rounded-[18px] border border-[var(--opryn-line)] bg-white px-5 text-sm font-semibold text-[#354156] shadow-[0_8px_24px_rgba(7,27,61,.035)] hover:-translate-y-0.5 hover:border-[#c9d9f0] hover:shadow-[0_12px_30px_rgba(7,27,61,.07)]"
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
    <section className="owner-working-strip">
      {["processing", "extracting", "organizing"].includes(learning.status) ? (
        <OprynThinkingOrb
          state="composing"
          size={20}
          label="Preparing findings"
          decorative
        />
      ) : null}
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--opryn-blue)]">
          {ready ? "New knowledge ready" : `Learning from ${provider}`}
        </p>
        <h2 className="mt-1 text-sm font-semibold text-[var(--opryn-navy)]">
          {ready
            ? `${provider} taught Opryn about ${learning.name}.`
            : learning.status === "received"
              ? `${learning.name} received. Waiting to process.`
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
      ) : null}
    </section>
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
