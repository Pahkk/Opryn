import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  FileCheck2,
  Lightbulb,
  Network,
  ShieldCheck,
} from "lucide-react";

type Recommendation = {
  id: string;
  title: string;
  reason: string;
  suggested_prompt: string;
};
type KnowledgeChunk = {
  id: string;
  content: string;
  source_type: string;
  process_id: string | null;
};
type KnowledgeProcess = {
  id: string;
  title: string;
  summary: string;
  href?: string;
  roles: string[];
  chunks: KnowledgeChunk[];
};
type KnowledgeGap = {
  id: string;
  question: string;
  person: string;
  imageUrl?: string;
};

export function ProcessIdeas({
  organizationName,
  recommendations,
  processTitles,
}: {
  organizationName: string;
  recommendations: Recommendation[];
  processTitles: string[];
}) {
  const questions = processTitles
    .slice(0, 3)
    .flatMap((title) => [
      `What are the steps for ${title}?`,
      `What should I watch out for during ${title}?`,
    ])
    .slice(0, 4);
  if (!recommendations.length && !questions.length) return null;
  return (
    <section className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-2xl border border-[#dce4f2] bg-[linear-gradient(135deg,#f5f8ff,#fff)] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#177257]">
              <Lightbulb className="size-4" /> Recommended next
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              Process ideas for {organizationName}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#6d7990]">
              Based on what you said is repetitive, hard to hand off, or still
              dependent on you.
            </p>
          </div>
          <Link
            href="/app/getting-started"
            className="shrink-0 text-xs font-semibold text-[#3158d8]"
          >
            View plan
          </Link>
        </div>
        {recommendations.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {recommendations.slice(0, 4).map((idea) => (
              <Link
                key={idea.id}
                href={`/app/processes/new?recommendation=${idea.id}&returnTo=${encodeURIComponent("/app/processes")}`}
                className="group rounded-xl border border-[#dfe5f2] bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-[#9eafe3] hover:shadow-sm"
              >
                <p className="text-sm font-semibold group-hover:text-[#3158d8]">
                  {idea.title}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#748095]">
                  {idea.reason}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#3158d8]">
                  Teach Opryn <ArrowRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href="/app/getting-started/learn"
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#3158d8] px-4 text-sm font-semibold text-white"
          >
            Tell Opryn about the business <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      <div className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#718095]">
          <CircleHelp className="size-4" /> Try asking
        </p>
        <h2 className="mt-2 font-semibold">Use what Opryn already knows</h2>
        <div className="mt-4 space-y-2">
          {questions.length ? (
            questions.map((question) => (
              <Link
                key={question}
                href={`/app/ask?q=${encodeURIComponent(question)}`}
                className="group flex items-center justify-between gap-3 rounded-xl bg-[#f7f9fc] px-3.5 py-3 text-xs font-medium leading-5 text-[#526077] hover:bg-[#edf2ff] hover:text-[#3158d8]"
              >
                {question}
                <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
              </Link>
            ))
          ) : (
            <p className="rounded-xl bg-[#f7f9fc] p-4 text-xs leading-5 text-[#7a8698]">
              Approve your first process and Opryn will suggest useful questions
              here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function KnowledgeTree({
  organizationName,
  processes,
  gaps = [],
}: {
  organizationName: string;
  processes: KnowledgeProcess[];
  gaps?: KnowledgeGap[];
}) {
  const totalChunks = processes.reduce(
    (total, process) => total + process.chunks.length,
    0,
  );
  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-[#dfe5ed] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#e5e9ef] bg-[#111d34] p-5 text-white sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#aebbd2]">
            <Network className="size-4" /> Live knowledge tree
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-.03em]">
            Everything Opryn can currently use
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#bdc8da]">
            Every connected node is approved company knowledge. Draft processes
            stay out of employee answers until you approve them.
          </p>
        </div>
        <div className="flex gap-2 text-center">
          <TreeMetric label="Processes" value={processes.length} />
          <TreeMetric label="Knowledge" value={totalChunks} />
          <TreeMetric label="Gaps" value={gaps.length} />
        </div>
      </div>
      {!processes.length && !gaps.length ? (
        <div className="p-7 text-center sm:p-10">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
            <Network className="size-5" />
          </span>
          <h3 className="mt-4 font-semibold">
            Your knowledge tree starts here
          </h3>
          <p className="mt-2 text-sm text-[#718095]">
            Approve a process to connect its steps, rules, exceptions, and
            assigned roles.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto p-5 sm:p-7">
          <div className="min-w-0 sm:min-w-[760px]">
            <div className="grid grid-cols-1 items-stretch sm:grid-cols-[220px_48px_1fr]">
              <div className="self-center rounded-2xl border border-[#bccaf0] bg-[#f3f6ff] p-4 text-center shadow-[0_10px_25px_rgba(49,88,216,.08)]">
                <span className="mx-auto grid size-10 place-items-center rounded-xl bg-[#3158d8] text-white">
                  <BookOpenCheck className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{organizationName}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[.08em] text-[#748095]">
                  Approved knowledge
                </p>
              </div>
              <div className="relative h-7 sm:h-auto">
                <div className="absolute inset-y-8 left-1/2 w-px bg-[#c5d0e1]" />
                <div className="absolute left-0 top-1/2 hidden h-px w-full bg-[#c5d0e1] sm:block" />
              </div>
              <div className="space-y-4">
                {gaps.length ? <KnowledgeGapBranch gaps={gaps} /> : null}
                {processes.map((process) => (
                  <ProcessBranch key={process.id} process={process} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function KnowledgeGapBranch({ gaps }: { gaps: KnowledgeGap[] }) {
  return (
    <article className="relative rounded-2xl border border-dashed border-[#d5a6a9] bg-[#fff8f8] p-4 before:absolute before:right-full before:top-1/2 before:hidden before:h-px before:w-12 before:bg-[#c5d0e1] sm:before:block">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff0f1] text-[#ae4d55]">
            <CircleHelp className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Knowledge gaps</h3>
            <p className="mt-1 text-[11px] text-[#7c6b70]">
              Questions waiting for an approved owner answer
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#a04e55] shadow-sm">
          {gaps.length} open
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {gaps.slice(0, 6).map((gap) => (
          <Link
            key={gap.id}
            href={`#gap-${gap.id}`}
            className="rounded-xl border border-[#eed9db] bg-white p-3 text-left transition hover:border-[#d5a6a9]"
          >
            <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#59484d]">
              {gap.question}
            </p>
            <p className="mt-1.5 text-[9px] uppercase tracking-[.07em] text-[#9b7d83]">
              Asked by {gap.person}
              {gap.imageUrl ? " · Photo attached" : ""}
            </p>
          </Link>
        ))}
      </div>
    </article>
  );
}

export function ProcessDetailGuide({
  processId,
  title,
  roles,
  counts,
}: {
  processId: string;
  title: string;
  roles: string[];
  counts: {
    steps: number;
    rules: number;
    exceptions: number;
    questions: number;
  };
}) {
  const questions = [
    `Walk me through ${title}.`,
    `What decisions or approvals matter during ${title}?`,
    `What can go wrong during ${title}, and what should I do?`,
  ];
  return (
    <section className="mb-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <div className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#718095]">
          Process coverage
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <CoverageMetric label="Steps" value={counts.steps} />
          <CoverageMetric label="Rules" value={counts.rules} />
          <CoverageMetric label="Exceptions" value={counts.exceptions} />
          <CoverageMetric label="Questions" value={counts.questions} />
        </div>
        <div className="mt-4 border-t border-[#edf0f4] pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8993a2]">
            Connected roles
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roles.length ? (
              roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-[#edf2ff] px-2.5 py-1 text-[10px] font-semibold text-[#405ba9]"
                >
                  {role}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#7a8698]">
                Available to every role
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[#dce4f2] bg-[#f5f8ff] p-5">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
          <CircleHelp className="size-4" /> Questions this process can answer
        </p>
        <div className="mt-3 grid gap-2">
          {questions.map((question) => (
            <Link
              key={question}
              href={`/app/ask?q=${encodeURIComponent(question)}`}
              className="group flex items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2.5 text-xs font-medium text-[#526077] shadow-sm hover:text-[#3158d8]"
            >
              {question}
              <ArrowRight className="size-3.5 shrink-0 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
        <Link
          href={`/app/ask?q=${encodeURIComponent(`What else should I know about ${title}?`)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3158d8]"
        >
          Ask something else <ArrowRight className="size-3" />
        </Link>
        <span className="sr-only">Process ID {processId}</span>
      </div>
    </section>
  );
}

function ProcessBranch({ process }: { process: KnowledgeProcess }) {
  const groups = groupChunks(process.chunks);
  return (
    <article className="relative rounded-2xl border border-[#dce3ec] bg-[#fbfcfe] p-4 before:absolute before:right-full before:top-1/2 before:hidden before:h-px before:w-12 before:bg-[#c5d0e1] sm:before:block">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eaf7f1] text-[#208063]">
            <FileCheck2 className="size-4" />
          </span>
          <div>
            <Link
              href={process.href ?? `/app/processes/${process.id}`}
              className="text-sm font-semibold hover:text-[#3158d8]"
            >
              {process.title}
            </Link>
            <p className="mt-1 line-clamp-1 text-[11px] text-[#748095]">
              {process.summary || "Approved company process"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#637086] shadow-sm">
          {process.chunks.length} nodes
        </span>
      </div>
      {process.roles.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {process.roles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 rounded-full bg-[#edf2ff] px-2 py-1 text-[9px] font-bold text-[#425ca9]"
            >
              <ShieldCheck className="size-3" /> {role}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <details
            key={group.type}
            className="group rounded-xl border border-[#e2e7ed] bg-white p-3 open:sm:col-span-2"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold text-[#526077]">
              <span className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${group.color}`} />
                {group.label}
              </span>
              <span className="rounded-full bg-[#f1f4f8] px-1.5 py-0.5 text-[9px]">
                {group.items.length}
              </span>
            </summary>
            <div className="mt-3 space-y-2 border-t border-[#edf0f4] pt-3">
              {group.items.map((item) => (
                <p
                  key={item.id}
                  className="rounded-lg bg-[#f7f9fc] px-2.5 py-2 text-[10px] leading-4 text-[#69768a]"
                >
                  {item.content}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </article>
  );
}

function groupChunks(chunks: KnowledgeChunk[]) {
  const copy: Record<string, { label: string; color: string }> = {
    process_summary: { label: "Overview", color: "bg-[#3158d8]" },
    process_step: { label: "Steps", color: "bg-[#35a27c]" },
    rule: { label: "Rules", color: "bg-[#756b9a]" },
    exception: { label: "Exceptions", color: "bg-[#c45c64]" },
    owner_answer: { label: "Owner answers", color: "bg-[#7c61c9]" },
    role_instruction: { label: "Role guidance", color: "bg-[#4f86ba]" },
  };
  const groups = new Map<string, KnowledgeChunk[]>();
  for (const chunk of chunks)
    groups.set(chunk.source_type, [
      ...(groups.get(chunk.source_type) ?? []),
      chunk,
    ]);
  return [...groups.entries()].map(([type, items]) => ({
    type,
    items,
    label: copy[type]?.label ?? "Knowledge",
    color: copy[type]?.color ?? "bg-[#8a95a5]",
  }));
}

function TreeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl bg-white/8 px-3 py-2">
      <strong className="block text-lg">{value}</strong>
      <span className="text-[9px] uppercase tracking-[.08em] text-[#aebbd2]">
        {label}
      </span>
    </div>
  );
}

function CoverageMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] px-2 py-3">
      <strong className="block text-lg tracking-[-.03em]">{value}</strong>
      <span className="text-[9px] uppercase tracking-[.07em] text-[#7a8698]">
        {label}
      </span>
    </div>
  );
}
