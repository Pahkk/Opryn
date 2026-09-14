"use client";

import { useState } from "react";

const questions = [
  [
    "Is this just SOP software?",
    "No. Opryn can create processes, but its real job is to keep learning how your company operates and help employees work without constantly relying on the owner.",
  ],
  [
    "Do I have to document everything myself?",
    "No. Explain a real task, upload something you already use, or bring in existing company material. Opryn prepares the useful parts for your review.",
  ],
  [
    "What happens when Opryn doesn't know the answer?",
    "It asks the right owner or admin. That answer can become approved company knowledge, so the same question is handled next time.",
  ],
  [
    "Will it make up answers?",
    "Opryn answers from approved company knowledge and shows the source. If the business has not taught it enough, it says so instead of inventing policy.",
  ],
  [
    "What kinds of businesses is Opryn for?",
    "Growing small businesses where important operational knowledge still lives with the owner or a small number of key employees.",
  ],
  [
    "Can I use Opryn before I hire someone?",
    "Yes. Capturing the answers and processes before someone starts makes the first handoff much easier.",
  ],
] as const;

export function MarketingFAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="editorial-section border-t border-[#e0e5eb] bg-white">
      <div className="container-shell grid gap-14 lg:grid-cols-[.7fr_1.3fr] lg:gap-24">
        <div>
          <p className="editorial-index">FAQ</p>
          <h2 className="editorial-title mt-5">Questions owners usually ask.</h2>
          <p className="mt-6 max-w-[420px] text-base leading-7 text-[#667184]">
            Still wondering whether Opryn fits your business? Start here.
          </p>
        </div>
        <div className="border-t border-[#cfd6df]">
          {questions.map(([question, answer], index) => {
            const active = open === index;
            return (
              <div key={question} className="border-b border-[#d9dfe6]">
                <button
                  type="button"
                  onClick={() => setOpen(active ? -1 : index)}
                  aria-expanded={active}
                  className="flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left text-sm font-semibold text-[#263247]"
                >
                  {question}
                  <span aria-hidden="true" className="font-mono text-base font-normal text-[#788393]">
                    {active ? "−" : "+"}
                  </span>
                </button>
                <div className={`grid transition-[grid-template-rows] duration-300 ${active ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="max-w-[650px] pb-6 text-sm leading-7 text-[#687487]">{answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
