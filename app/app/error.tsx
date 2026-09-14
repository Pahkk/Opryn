"use client";

import { OprynArc } from "@/components/opryn/opryn-arc";
export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="opryn-surface max-w-md p-8 text-center sm:p-10">
        <OprynArc size={52} progress={45} state="unknown" className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
          This page couldn&apos;t load.
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--opryn-muted)]">
          Your company data is safe. Try loading the page again.
        </p>
        <button onClick={reset} className="opryn-action mt-6">
          Try Again
        </button>
      </div>
    </div>
  );
}
