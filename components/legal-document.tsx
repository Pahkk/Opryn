import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

export function LegalDocument({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div id="top" className="legal-document min-h-screen bg-[#fbfcfe]">
      <header className="legal-nav border-b border-[#e3e8ef] bg-white/90 backdrop-blur-xl">
        <div className="container-shell flex h-[72px] items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#566174] transition-colors hover:text-[#111b2e]"
          >
            <ArrowLeft size={15} /> Back to Opryn
          </Link>
        </div>
      </header>
      <main>
        <article className="legal-article mx-auto w-[min(760px,calc(100%-40px))] py-16 sm:py-24">
          <div className="section-label">Legal</div>
          <h1 className="text-[clamp(40px,7vw,64px)] font-semibold leading-[1.02] tracking-[-.055em]">
            {title}
          </h1>
          <p className="mt-6 max-w-[680px] text-lg leading-8 text-[#647084]">
            {description}
          </p>
          <p className="mt-5 text-sm font-medium text-[#7b8696]">
            Effective September 9, 2026
          </p>
          <div className="legal-note mt-12 rounded-2xl border border-[#dce3ec] bg-white px-5 py-4 text-sm leading-7 text-[#536074] shadow-[0_12px_35px_rgba(23,36,58,.04)] sm:px-6">
            This document applies to the Opryn website, application, and
            services that link to this page.
          </div>
          <div className="legal-copy mt-14">{children}</div>
        </article>
      </main>
      <footer className="border-t border-[#e3e8ef] bg-white py-8">
        <div className="container-shell flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-[#7b8696]">
            © 2026 Opryn. Built for owners building real teams.
          </p>
          <nav
            className="flex items-center gap-5"
            aria-label="Legal navigation"
          >
            <Link
              href="/privacy"
              className="text-xs font-medium text-[#667286] hover:text-[#111b2e]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs font-medium text-[#667286] hover:text-[#111b2e]"
            >
              Terms
            </Link>
            <Link
              href="/"
              className="text-xs font-medium text-[#667286] hover:text-[#111b2e]"
            >
              Home
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
