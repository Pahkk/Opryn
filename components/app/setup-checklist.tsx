"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";

import { setupChecklistProgress, type SetupItem } from "@/lib/setup-checklist";

export function SetupChecklist({ items }: { items: SetupItem[] }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const { completed, total } = setupChecklistProgress(items);
  if (completed === total) return null;

  async function hide() {
    setHidden(true);
    await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checklistHidden: true }),
    });
  }

  return (
    <section className="home-reveal overflow-hidden rounded-[22px] border border-[#d8e5f6] bg-[#f5f9ff] shadow-[var(--opryn-shadow-sm)]">
      <div className="flex items-start justify-between gap-4 px-6 py-5 sm:px-7">
        <div>
          <p className="opryn-section-label">Finish setting up Opryn</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-.03em]">
            {completed} / {total} ready
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void hide()}
          className="grid size-10 place-items-center rounded-[10px] text-[var(--opryn-muted)] hover:bg-white"
          aria-label="Hide setup checklist"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid border-t border-[#dfe9f6] bg-white lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-h-20 items-center gap-3 border-b border-[var(--opryn-line)] px-5 text-sm last:border-b-0 hover:bg-[var(--opryn-blue-surface)] lg:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <span
              className={`grid size-5 place-items-center rounded-full border ${item.complete ? "border-[var(--opryn-blue)] bg-[var(--opryn-blue)] text-white" : "border-[var(--opryn-line-strong)]"}`}
            >
              {item.complete ? <Check size={12} strokeWidth={3} /> : null}
            </span>
            <span
              className={
                item.complete ? "text-[var(--opryn-muted)]" : "font-semibold"
              }
            >
              {item.label}
              {item.optional ? (
                <span className="mt-1 block text-xs font-normal text-[var(--opryn-muted)]">
                  Optional
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
