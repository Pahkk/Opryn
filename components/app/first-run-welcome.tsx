import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { OprynLearningFlow } from "@/components/opryn/opryn-learning-flow";
import { onboardingSourceLabel } from "@/lib/onboarding";

export function FirstRunWelcome({
  firstName,
  organizationName,
  selectedSources,
  currentStep,
  hasApprovedKnowledge,
  hasSuccessfulTest,
  latestLearning,
  pendingLearning,
}: {
  firstName: string;
  organizationName: string;
  selectedSources: string[];
  currentStep: string;
  hasApprovedKnowledge: boolean;
  hasSuccessfulTest: boolean;
  pendingLearning?: { provider?: string; name?: string; stage?: string } | null;
  latestLearning?: {
    name: string;
    client_kind: string;
    status: string;
    result_summary: unknown;
    process_id: string | null;
  } | null;
}) {
  const hasStarted = selectedSources.length > 0 || hasApprovedKnowledge;
  const inferredStep = hasApprovedKnowledge
    ? hasSuccessfulTest
      ? "invite"
      : "test"
    : hasStarted
      ? "teach"
      : "knowledge";
  const resumableStep =
    currentStep === "goals" && !hasStarted ? "knowledge" : currentStep;
  const continueStep = [
    "knowledge",
    "goals",
    "connections",
    "setup",
    "teach",
    "test",
    "invite",
  ].includes(resumableStep)
    ? resumableStep
    : inferredStep;
  const sources = selectedSources.map(onboardingSourceLabel).slice(0, 4);
  const learningProvider =
    latestLearning?.client_kind === "chatgpt"
      ? "ChatGPT"
      : latestLearning?.client_kind === "claude"
        ? "Claude"
        : "your AI tool";
  const learningReady = Boolean(
    latestLearning &&
    ["needs_review", "complete"].includes(latestLearning.status),
  );

  return (
    <div className="home-reveal mx-auto max-w-6xl py-3 sm:py-8">
      {pendingLearning?.stage === "waiting" && !latestLearning ? (
        <section className="mb-5 rounded-[20px] border border-[#cfe0f7] bg-[#eef6ff] p-5">
          <h2 className="text-xl font-bold">
            Waiting for{" "}
            {pendingLearning.provider === "claude" ? "Claude" : "ChatGPT"}
          </h2>
          <p className="mt-2 text-sm text-[#52627a]">
            Your learning request for {pendingLearning.name} is saved.
          </p>
          <Link href="/onboarding?step=teach" className="opryn-action mt-4">
            Continue Learning
          </Link>
        </section>
      ) : null}
      {latestLearning && latestLearning.status !== "failed" ? (
        <section className="mb-5 flex flex-col gap-4 rounded-[20px] border border-[#cfe0f7] bg-[#eef6ff] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.1em] text-[var(--opryn-blue)]">
              {learningReady
                ? "Findings ready for review"
                : "Opryn is learning"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--opryn-navy)]">
              {learningReady
                ? `Opryn received ${latestLearning.name} from ${learningProvider}.`
                : `Learning ${latestLearning.name} from ${learningProvider}…`}
            </h2>
          </div>
          {learningReady && latestLearning.process_id ? (
            <Link
              href={`/app/processes/${latestLearning.process_id}?returnTo=${encodeURIComponent("/onboarding?step=teach")}`}
              className="opryn-action shrink-0"
            >
              Review findings <ArrowRight size={15} />
            </Link>
          ) : (
            <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-[#d6e5f7]">
              <span className="opryn-learning-progress block h-full w-2/3 rounded-full bg-[var(--opryn-blue)]" />
            </div>
          )}
        </section>
      ) : null}
      <section className="overflow-hidden rounded-[26px] border border-[#d6e2f1] bg-[#f4f8fd] shadow-[0_24px_70px_rgba(31,64,111,.09)]">
        <div className="grid gap-10 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-14 lg:py-16">
          <div>
            <p className="opryn-page-kicker">Welcome to Opryn, {firstName}</p>
            <h1 className="mt-4 max-w-2xl text-[clamp(2.8rem,7vw,5.4rem)] font-semibold leading-[.96] tracking-[-.07em] text-[var(--opryn-navy)]">
              Let&apos;s get Opryn useful for {organizationName}.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--opryn-muted)] sm:text-lg sm:leading-8">
              Show Opryn where your business knowledge already lives. We&apos;ll
              organize what it learns so your team can start getting answers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/onboarding?step=${continueStep}`}
                className="opryn-action min-h-12 px-5"
              >
                {hasStarted ? "Continue Setup" : "Get Started"}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/app/ask"
                className="opryn-secondary-action min-h-12 px-5"
              >
                Explore Opryn First
              </Link>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#778497]">
              You can leave setup anytime. Opryn saves your place.
            </p>
          </div>

          <OprynLearningFlow
            sources={sources}
            completeThrough={hasApprovedKnowledge ? "approved" : "sources"}
            detail={
              hasApprovedKnowledge
                ? "Your first approved answer is available to people and AI tools with access."
                : "Start with one source or explanation. Nothing becomes company policy until you review it."
            }
          />
        </div>
      </section>

      <section className="mt-9 grid gap-6 border-t border-[var(--opryn-line)] pt-8 sm:grid-cols-3">
        {[
          ["01", "Show Opryn", "Use the documents and tools you already have."],
          [
            "02",
            "Review what it learned",
            "Accept only what your team should rely on.",
          ],
          [
            "03",
            "Let your team ask",
            "One answer can handle the next repeat question.",
          ],
        ].map(([number, title, description]) => (
          <div key={number} className="grid grid-cols-[36px_1fr] gap-3">
            <span className="font-mono text-sm font-semibold text-[var(--opryn-blue)]">
              {number}
            </span>
            <div>
              <h2 className="font-semibold text-[var(--opryn-navy)]">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--opryn-muted)]">
                {description}
              </p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
