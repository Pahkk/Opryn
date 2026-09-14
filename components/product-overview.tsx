import {
  ArrowRight,
  Check,
  FileCheck2,
  MessageCircleQuestion,
  Mic2,
  ShieldCheck,
} from "lucide-react";
import { SectionIntro } from "./ui";

const overviewSteps = [
  {
    number: "01",
    icon: Mic2,
    eyebrow: "The owner teaches",
    title: "Show Opryn how work gets done.",
    copy: "Explain a task in plain language. Opryn pulls out the steps, decisions, and rules for you to review.",
    preview: (
      <div className="overview-preview">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-[#3158d8] text-white shadow-sm">
            <Mic2 size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8792a3]">
              Explaining a process
            </p>
            <p className="truncate text-xs font-semibold text-[#263247]">
              “Here&apos;s how we approve a refund...”
            </p>
          </div>
          <span className="ml-auto text-[10px] font-semibold text-[#c14c55]">
            01:42
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#dfe5ed] bg-white px-3 py-2.5">
          <FileCheck2 size={14} className="text-[#3158d8]" />
          <span className="text-[11px] font-semibold text-[#465266]">
            Refund Approval · 5 steps found
          </span>
          <span className="ml-auto rounded-full bg-[#eaf7f2] px-2 py-1 text-[9px] font-bold text-[#18795d]">
            READY TO REVIEW
          </span>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    icon: MessageCircleQuestion,
    eyebrow: "The team asks",
    title: "Employees get the company answer.",
    copy: "Your team asks Opryn instead of interrupting you. Every answer is grounded in knowledge you approved.",
    preview: (
      <div className="overview-preview">
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#3158d8] px-3.5 py-2.5 text-[11px] font-medium leading-5 text-white">
          Can I approve a $400 refund?
        </div>
        <div className="mt-2 max-w-[94%] rounded-2xl rounded-bl-md border border-[#dde4ed] bg-white px-3.5 py-3 text-[11px] leading-5 text-[#485568] shadow-sm">
          Refunds over $250 need owner approval.
          <div className="mt-2 flex items-center gap-1.5 border-t border-[#edf0f4] pt-2 text-[9px] font-bold uppercase tracking-[.08em] text-[#3158d8]">
            <FileCheck2 size={11} /> Source: Refund Policy
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    icon: Check,
    eyebrow: "Opryn keeps learning",
    title: "Answer new questions only once.",
    copy: "If the answer is missing, Opryn asks you. Approve your answer once and it is ready for the next person.",
    preview: (
      <div className="overview-preview">
        <div className="flex items-start gap-3 rounded-xl border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-[#b16f17] shadow-sm">
            <MessageCircleQuestion size={14} />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#a46818]">
              Needs owner answer
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#4d4539]">
              Can deposits be split across two payments?
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#cfe7de] bg-[#f1faf6] px-3 py-2.5">
          <span className="grid size-5 place-items-center rounded-full bg-[#1b8b69] text-white">
            <Check size={11} strokeWidth={3} />
          </span>
          <span className="text-[11px] font-semibold text-[#326252]">
            Approved answer saved for next time
          </span>
        </div>
      </div>
    ),
  },
] as const;

export function ProductOverview() {
  return (
    <section className="section overview-section border-y border-[#e6eaf0] bg-white">
      <div className="container-shell">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_380px]">
          <SectionIntro
            label="What Opryn is"
            title="The place your team goes when they need to know how your business works."
            copy="Opryn is a company knowledge system built for owners who are hiring, delegating, and tired of answering the same questions."
          />
          <div className="reveal rounded-2xl border border-[#dce4f4] bg-[#f5f8ff] p-5 text-sm leading-6 text-[#4d5e7a]">
            <div className="flex items-center gap-2 font-semibold text-[#263b6b]">
              <ShieldCheck size={17} className="text-[#3158d8]" />
              Opryn does not guess company policy.
            </div>
            <p className="mt-2">
              It answers from approved knowledge, shows the source, and asks the
              owner when the business has not taught it enough yet.
            </p>
          </div>
        </div>

        <div className="overview-grid mt-12 grid gap-5 lg:grid-cols-3">
          {overviewSteps.map(
            ({ number, icon: Icon, eyebrow, title, copy, preview }, index) => (
              <article className="overview-card reveal" key={number}>
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl border border-[#dbe3f5] bg-[#f3f6ff] text-[#3158d8]">
                    <Icon size={17} />
                  </span>
                  <span className="font-mono text-[11px] font-bold text-[#a0a9b7]">
                    {number}
                  </span>
                </div>
                <p className="mt-6 text-[10px] font-bold uppercase tracking-[.14em] text-[#3158d8]">
                  {eyebrow}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-.03em] text-[#172238]">
                  {title}
                </h3>
                <p className="mt-3 min-h-[72px] text-sm leading-6 text-[#667286]">
                  {copy}
                </p>
                {preview}
                {index < overviewSteps.length - 1 ? (
                  <span className="overview-connector" aria-hidden="true">
                    <ArrowRight size={15} />
                  </span>
                ) : null}
              </article>
            ),
          )}
        </div>

        <p className="reveal mx-auto mt-9 max-w-[760px] text-center text-sm font-medium leading-6 text-[#5f6d82]">
          The result: faster handoffs, fewer interruptions, and a business that
          becomes less dependent on one person knowing everything.
        </p>
      </div>
    </section>
  );
}
