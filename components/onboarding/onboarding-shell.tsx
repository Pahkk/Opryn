"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { OprynLogo } from "@/components/opryn-logo";
import { MotionRegion } from "@/components/motion/motion-region";

const flow = ["Business", "Sources", "Context", "Learn", "Ready"];
const progressValues = [8, 28, 50, 74, 100];

export function OnboardingShell({
  children,
  phase,
  onHelp,
  exitHref = "/",
}: {
  children: ReactNode;
  phase: number;
  onHelp?: () => void;
  exitHref?: string;
}) {
  const progress = progressValues[phase] ?? 8;

  return (
    <main className="opryn-onboarding min-h-screen overflow-hidden bg-[#f6f9fd] text-[#071b3d]">
      <header className="opryn-onboarding-nav bg-white">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-5">
            <OprynLogo size="default" priority />
            <span className="hidden border-l border-[#e1e7ef] pl-5 text-[11px] font-bold uppercase tracking-[.15em] text-[#748298] sm:block">
              Business setup
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {onHelp ? (
              <button
                type="button"
                onClick={onHelp}
                className="min-h-11 rounded-xl px-3 text-sm font-bold text-[#496078] transition-colors hover:bg-[#edf4ff] hover:text-[#0b5ee3] sm:px-4"
              >
                Ask for help
              </button>
            ) : null}
            <Link
              href={exitHref}
              className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[#748298] transition-colors hover:bg-[#f2f4f7] hover:text-[#17345f] sm:px-4"
            >
              Exit setup
            </Link>
          </div>
        </div>
      </header>

      <OnboardingProgress phase={phase} progress={progress} />

      <div className="mx-auto max-w-[900px] px-4 pb-28 pt-7 sm:px-8 sm:pb-20 sm:pt-10">
        <section className="opryn-onboarding-stage min-w-0 overflow-hidden rounded-[28px] border border-[#e0e7f0] bg-white px-5 py-8 shadow-[0_26px_80px_rgba(26,67,122,.08)] sm:px-10 sm:py-11 lg:px-14 lg:py-14">
          {children}
        </section>
      </div>
    </main>
  );
}

function OnboardingProgress({
  phase,
  progress,
}: {
  phase: number;
  progress: number;
}) {
  return (
    <div
      className="opryn-onboarding-progress border-y border-[#e4eaf2] bg-white"
      role="progressbar"
      aria-label="Opryn setup progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-valuetext={`${flow[phase]}, step ${phase + 1} of ${flow.length}`}
    >
      <div className="mx-auto max-w-[900px] px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center justify-between sm:hidden">
          <p className="text-sm font-extrabold text-[#17345f]">{flow[phase]}</p>
          <p className="text-xs font-bold tabular-nums text-[#728099]">
            {phase + 1} of {flow.length}
          </p>
        </div>
        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-[#e8eef6] sm:hidden">
          <div
            className="h-full w-full origin-left rounded-full bg-[#2782ff] transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>

        <div className="relative hidden sm:block">
          <div className="absolute left-5 right-5 top-[15px] h-1 rounded-full bg-[#e8eef6]" />
          <div
            className="absolute left-5 right-5 top-[15px] h-1 origin-left rounded-full bg-[#2782ff] transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${phase / 4})` }}
          />
          <ol className="relative grid grid-cols-5">
            {flow.map((label, index) => {
              const complete = index < phase;
              const current = index === phase;
              return (
                <li key={label} className="flex flex-col items-center">
                  <span
                    className={`grid size-8 place-items-center rounded-full border-[3px] border-white transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none ${
                      complete
                        ? "bg-[#2782ff] text-white shadow-[0_4px_12px_rgba(39,130,255,.22)]"
                        : current
                          ? "scale-110 bg-[#dceaff] text-[#146bff] ring-2 ring-[#8db9ff]"
                          : "bg-[#e8eef6] text-[#8c9aae]"
                    }`}
                    aria-hidden="true"
                  >
                    {complete ? (
                      <Check size={13} strokeWidth={3} />
                    ) : (
                      <span className="size-2 rounded-full bg-current" />
                    )}
                  </span>
                  <span
                    className={`mt-2 text-xs transition-all duration-300 ${
                      current
                        ? "font-extrabold text-[#0b5ed7]"
                        : complete
                          ? "font-bold text-[#365675]"
                          : "font-semibold text-[#8a96a8]"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

export function OnboardingTransition({
  children,
  transitionKey,
}: {
  children: ReactNode;
  transitionKey: string;
}) {
  return (
    <MotionRegion changeKey={transitionKey} variant="step">
      {children}
    </MotionRegion>
  );
}

export function OnboardingActions({
  back,
  next,
  nextLabel = "Continue",
  skip,
  busy,
}: {
  back?: () => void;
  next: () => void;
  nextLabel?: string;
  skip?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="sticky -bottom-8 z-10 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e7ef] bg-white pb-1 pt-6 sm:static sm:bottom-auto sm:bg-transparent sm:pb-0">
      <div>
        {back ? (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-[#65748a] transition-colors hover:bg-[#f1f4f8] hover:text-[#071b3d] disabled:opacity-50"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back
          </button>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {skip ? (
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="min-h-11 rounded-xl px-3 text-sm font-bold text-[#728099] transition-colors hover:bg-[#f1f4f8] hover:text-[#071b3d] disabled:opacity-50"
          >
            Skip for now
          </button>
        ) : null}
        <button
          type="button"
          onClick={next}
          disabled={busy}
          className="min-h-12 rounded-xl bg-[#146bff] px-6 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(20,107,255,.18)] transition duration-200 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:bg-[#095de5] hover:shadow-[0_14px_30px_rgba(20,107,255,.23)] active:scale-[.99] disabled:translate-y-0 disabled:cursor-wait disabled:opacity-55 motion-reduce:transform-none"
        >
          {busy ? "Saving…" : nextLabel}
        </button>
      </div>
    </div>
  );
}
