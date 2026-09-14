"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

type LearningStage = "sources" | "understanding" | "review" | "approved";

const stages: Array<{ id: LearningStage; label: string }> = [
  { id: "sources", label: "Sources" },
  { id: "understanding", label: "Understanding" },
  { id: "review", label: "Review" },
  { id: "approved", label: "Ready to use" },
];

export function OprynLearningFlow({
  sources,
  active = false,
  completeThrough = "sources",
  detail,
}: {
  sources: string[];
  active?: boolean;
  completeThrough?: LearningStage;
  detail?: string;
}) {
  const [activeProgress, setActiveProgress] = useState(0);
  const activeIndex = active
    ? activeProgress
    : Math.max(
        0,
        stages.findIndex((stage) => stage.id === completeThrough),
      );

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setActiveProgress((current) => Math.min(current + 1, stages.length - 2));
    }, 900);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <section
      className="opryn-learning-flow"
      aria-label={active ? "Opryn is learning" : "How Opryn learns"}
      aria-live={active ? "polite" : "off"}
    >
      <div className="opryn-learning-flow__sources">
        <p className="opryn-section-label">LEARNING FROM</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(sources.length ? sources : ["Your explanation"]).map((source) => (
            <span key={source} className="opryn-learning-source">
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="opryn-learning-flow__path" aria-hidden="true">
        <svg viewBox="0 0 700 72" preserveAspectRatio="none">
          <path
            className="opryn-learning-flow__track"
            d="M8 36 C120 36 128 12 236 20 S358 62 464 48 S578 18 692 36"
          />
          <path
            className={active ? "opryn-learning-flow__signal" : ""}
            d="M8 36 C120 36 128 12 236 20 S358 62 464 48 S578 18 692 36"
          />
        </svg>
      </div>

      <ol className="opryn-learning-flow__stages">
        {stages.map((stage, index) => {
          const complete = !active && index <= activeIndex;
          const current = active && index === activeIndex;
          return (
            <li
              key={stage.id}
              className={`opryn-learning-stage ${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
            >
              <span className="opryn-learning-stage__mark">
                {complete ? <Check size={13} strokeWidth={3} /> : index + 1}
              </span>
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>

      {detail ? (
        <p className="mt-5 text-sm leading-6 text-[var(--opryn-muted)]">
          {detail}
        </p>
      ) : null}
    </section>
  );
}
