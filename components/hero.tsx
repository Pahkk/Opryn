import Link from "next/link";
import { OprynLogo } from "./opryn-logo";

export function Hero() {
  return (
    <section id="top" className="hero-section editorial-hero">
      <div className="container-shell">
        <div className="grid items-center gap-14 lg:grid-cols-[.88fr_1.12fr] lg:gap-20">
          <div className="hero-copy max-w-[620px]">
            <div className="hero-stagger hero-stagger-1 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.14em] text-[#163f98]">
              <span className="h-px w-8 bg-[#163f98]" />
              For owners whose team still asks them everything
            </div>
            <h1 className="display-title mt-7 balance">
              <span className="hero-headline-line hero-headline-line-1">
                Build a business that
              </span>
              <span className="hero-headline-line hero-headline-line-2">
                <span className="hero-emphasis">doesn&apos;t depend on you.</span>
              </span>
            </h1>
            <p className="hero-stagger hero-stagger-2 lead mt-7 max-w-[590px]">
              Teach Opryn how your business works. Your team gets clear,
              company-specific answers without stopping you every time
              something comes up.
            </p>
            <div className="hero-stagger hero-stagger-3 mt-7 border-l border-[#163f98] pl-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7a8595]">
                The next interruption Opryn can handle
              </p>
              <div className="hero-question-rotator mt-2" aria-hidden="true">
                <span>“Can I give this customer a discount?”</span>
                <span>“What happens when an invoice is overdue?”</span>
                <span>“Who can approve this refund?”</span>
              </div>
              <p className="sr-only">
                Opryn can answer repeat questions about discounts, overdue
                invoices, refunds, and other approved company procedures.
              </p>
            </div>
            <div className="hero-stagger hero-stagger-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="button button-primary min-w-[176px]" href="/signup">
                Start teaching Opryn <span aria-hidden="true">→</span>
              </Link>
              <a className="button button-secondary min-w-[150px]" href="#how-it-works">
                See how it works
              </a>
            </div>
            <p className="hero-stagger hero-stagger-5 mt-6 text-xs leading-5 text-[#748094]">
              For owners building a team—not another manual to maintain.
            </p>
          </div>

          <div className="hero-visual hero-product-stage relative">
            <div className="opryn-product-frame overflow-hidden">
              <div className="flex h-14 items-center justify-between border-b border-[#e3e7ed] px-5 sm:px-6">
                <OprynLogo size="small" />
                <span className="text-[11px] font-medium text-[#7b8594]">
                  Johnson Plumbing
                </span>
              </div>
              <div className="grid md:grid-cols-[156px_1fr]">
                <aside className="hidden border-r border-[#e5e9ef] bg-[#fafbfc] p-5 md:block">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#9aa3af]">
                    Owner inbox
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-.06em] text-[#19243a]">
                    3
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-[#748094]">
                    items actually need you
                  </p>
                  <div className="mt-8 border-t border-[#e3e7ed] pt-5">
                    <p className="text-[10px] text-[#8a94a2]">Handled this week</p>
                    <p className="mt-1 text-xl font-semibold">47 questions</p>
                    <p className="mt-1 text-[10px] font-semibold text-[#177257]">
                      4h 18m returned to you
                    </p>
                  </div>
                </aside>
                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4 border-b border-[#e5e9ef] pb-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#163f98]">
                        Sarah needs an answer
                      </p>
                      <h2 className="mt-2 text-lg font-semibold tracking-[-.025em] text-[#1c273a]">
                        Can commercial customers get Net-30 terms?
                      </h2>
                    </div>
                    <span className="shrink-0 text-[10px] text-[#8a94a2]">8 min ago</span>
                  </div>
                  <div className="py-6">
                    <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8a94a2]">
                      Your answer
                    </p>
                    <p className="mt-2 border-l-2 border-[#163f98] pl-4 text-sm leading-6 text-[#3e4a5d]">
                      Commercial customers can get Net-30 after we approve their
                      account.
                    </p>
                  </div>
                  <div className="border-t border-[#e5e9ef] pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#96651a]">
                      Opryn can remember this
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#263247]">
                      Approved commercial customers may receive Net-30 terms.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-[#163f98] px-3.5 py-2 text-[11px] font-semibold text-white">
                        Yes, remember it
                      </span>
                      <span className="rounded-lg border border-[#dce2e9] px-3.5 py-2 text-[11px] font-semibold text-[#5e697b]">
                        Edit
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="opryn-annotation hidden sm:block">
              <span>One answer</span>
              <i />
              <strong>ready for next time</strong>
            </div>
          </div>
        </div>
      </div>
      <a className="hero-scroll-cue" href="#why-opryn">
        <span>Why owners keep getting pulled back in</span>
        <i aria-hidden="true" />
      </a>
    </section>
  );
}
