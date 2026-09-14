import Link from "next/link";
import {
  BookOpenCheck,
  Bot,
  CheckCircle2,
  Cloud,
  FileText,
  Mic,
  PhoneCall,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

const sources = [
  { label: "Google Drive", icon: Cloud },
  { label: "Calls", icon: PhoneCall },
  { label: "Documents", icon: FileText },
  { label: "Voice", icon: Mic },
  { label: "Video", icon: Video },
];

export function LearningFlow() {
  return (
    <section className="section overflow-hidden border-y border-[#e4e9f0] bg-[#f5f7fb]">
      <div className="container-main">
        <div className="mx-auto max-w-3xl text-center">
          <div className="section-label">How Opryn learns</div>
          <h2 className="section-title">
            One trusted answer for your team and the tools they use.
          </h2>
          <p className="section-copy mx-auto">
            Opryn brings together the knowledge scattered across your business.
            Nothing becomes official until you approve it.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {sources.map(({ label, icon: Icon }, index) => (
              <div
                key={label}
                className={`${index === sources.length - 1 ? "col-span-2 mx-auto w-full max-w-[220px] sm:col-span-1 sm:max-w-none" : ""} rounded-2xl border border-[#dce3ec] bg-white px-3 py-4 text-center shadow-[0_8px_24px_rgba(24,39,66,.04)]`}
              >
                <span className="mx-auto grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
                  <Icon className="size-[17px]" />
                </span>
                <p className="mt-2 text-xs font-semibold text-[#455269]">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <FlowConnector />

          <div className="mx-auto max-w-sm rounded-[22px] border border-[#bfcdf2] bg-white p-5 text-center shadow-[0_18px_45px_rgba(49,88,216,.10)]">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#3158d8] text-white">
              <BookOpenCheck className="size-5" />
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#3158d8]">
              Opryn learns
            </p>
            <p className="mt-1 text-sm text-[#6d7990]">
              Finds useful processes, rules, and answers
            </p>
          </div>

          <FlowConnector />

          <div className="mx-auto max-w-sm rounded-[22px] border border-[#d9d4e7] bg-[var(--opryn-amber-surface)] p-5 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[#fff0c9] text-[#96651a]">
              <ShieldCheck className="size-5" />
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#96651a]">
              You review it
            </p>
            <p className="mt-1 text-sm text-[#786b55]">
              Approve, edit, or ignore what Opryn noticed
            </p>
          </div>

          <FlowConnector />

          <div className="mx-auto max-w-sm rounded-[22px] border border-[#bcded0] bg-[#f3faf7] p-5 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[#dff3ea] text-[#177257]">
              <CheckCircle2 className="size-5" />
            </span>
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#177257]">
              Approved knowledge
            </p>
            <p className="mt-1 text-sm text-[#5d766d]">
              One reliable source of truth for the business
            </p>
          </div>

          <div className="mx-auto h-8 w-px bg-[#c8d2df]" />
          <div className="mx-auto h-px w-1/2 max-w-[430px] bg-[#c8d2df]" />
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-4">
            <FlowAudience
              icon={Users}
              title="Employees"
              copy="Ask Opryn"
              href="/signup"
            />
            <FlowAudience
              icon={Bot}
              title="AI Agents"
              copy="API or MCP"
              href="/pricing"
            />
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-lg font-semibold tracking-[-.02em] text-[#18243a]">
            Teach Opryn once. Let your team and AI tools learn from the same
            approved source of truth.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#2446b8]"
          >
            Start teaching Opryn
          </Link>
        </div>
      </div>
    </section>
  );
}

function FlowConnector() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex h-10 w-8 flex-col items-center"
    >
      <span className="h-7 w-px bg-[#c8d2df]" />
      <span className="size-2 rotate-45 border-b border-r border-[#9cabbf]" />
    </div>
  );
}

function FlowAudience({
  icon: Icon,
  title,
  copy,
  href,
}: {
  icon: typeof Users;
  title: string;
  copy: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="relative border-t border-[#c8d2df] pt-5 text-center"
    >
      <span className="absolute left-1/2 top-0 h-5 w-px -translate-y-full bg-[#c8d2df]" />
      <span className="mx-auto grid size-10 place-items-center rounded-xl border border-[#dce3ec] bg-white text-[#3158d8] shadow-sm">
        <Icon className="size-[18px]" />
      </span>
      <p className="mt-2 text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-[#7a8698]">{copy}</p>
    </Link>
  );
}
