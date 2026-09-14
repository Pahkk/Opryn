"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";

type Source = {
  id: string;
  label: string;
  href: string | null;
  content: string;
};
export function AnswerSources({ sources }: { sources: Source[] }) {
  const [all, setAll] = useState(false);
  const visible = all ? sources : sources.slice(0, 3);
  return (
    <section
      className="answer-sources border-t border-[#e3eaf4] px-5 py-5 sm:px-6"
      aria-label="Answer sources"
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold text-[#243954]">Sources</h4>
        <span className="shrink-0 text-xs text-[#718096]">
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((source, index) => {
          const [title, ...sections] = source.label.split(/\s*→\s*/);
          return (
            <details
              key={source.id}
              className="answer-source group rounded-2xl border border-[#e0e7f1] bg-white transition-colors open:border-[#bdd1ef]"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#245fc9] rounded-2xl [&::-webkit-details-marker]:hidden">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#edf3fc] text-xs font-bold text-[#245fc9]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-[#203854]">
                    {title}
                  </span>
                  {sections.length ? (
                    <span className="mt-1 block break-words text-xs leading-5 text-[#68798e]">
                      {sections.join(" · ")}
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className="shrink-0 text-[#7388a3] transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <div className="px-4 pb-4 sm:pl-[60px]">
                {source.content ? (
                  <blockquote className="border-l-2 border-[#b9d0ef] pl-4 text-sm leading-7 text-[#52627a] whitespace-pre-wrap break-words">
                    {source.content}
                  </blockquote>
                ) : null}
                {source.href ? (
                  <Link
                    href={source.href}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-[#245fc9] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                  >
                    Open source <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="mt-3 text-xs text-[#718096]">
                    Supporting company knowledge
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
      {sources.length > 3 ? (
        <button
          type="button"
          onClick={() => setAll((value) => !value)}
          className="mt-3 min-h-11 text-sm font-semibold text-[#245fc9]"
        >
          {all ? "Show fewer sources" : `View all ${sources.length} sources`}
        </button>
      ) : null}
    </section>
  );
}
