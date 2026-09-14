"use client";

import { useState } from "react";

type Step = {
  id: string;
  step_order: number;
  title: string;
  description: string;
};

export function ProcessChecklist({
  processId,
  steps,
}: {
  processId: string;
  steps: Step[];
}) {
  void processId;
  const [done, setDone] = useState<string[]>([]);
  function toggle(id: string) {
    setDone((current) => {
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  }
  return (
    <div className="mt-8 space-y-4">
      {steps.map((step) => {
        const complete = done.includes(step.id);
        return (
          <div
            key={step.id}
            id={`step-${step.id}`}
            className={`grid scroll-mt-28 grid-cols-[36px_1fr_auto] gap-4 rounded-xl border p-4 transition target:border-[#3158d8] target:ring-4 target:ring-[#3158d8]/10 ${complete ? "border-[#cde4d9] bg-[#f5fbf8]" : "border-[#e3e7ed] bg-white"}`}
          >
            <span
              className={`grid size-9 place-items-center rounded-xl text-xs font-bold ${complete ? "bg-[#dff3ea] text-[#177257]" : "bg-[#edf2ff] text-[#3158d8]"}`}
            >
              {complete ? "✓" : step.step_order}
            </span>
            <div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[#657286]">
                {step.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle(step.id)}
              className={`min-h-10 self-start rounded-lg px-3 text-xs font-semibold ${complete ? "border border-[#c9dfd4] bg-white text-[#177257]" : "bg-[#3158d8] text-white"}`}
            >
              {complete ? "Done" : "Mark Done"}
            </button>
          </div>
        );
      })}
      {steps.length && done.length === steps.length ? (
        <p
          role="status"
          className="rounded-xl bg-[#eaf7f1] p-4 text-sm font-semibold text-[#177257]"
        >
          Process complete. You can reset any step if you need to run it again.
        </p>
      ) : null}
    </div>
  );
}
