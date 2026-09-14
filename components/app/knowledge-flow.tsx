import Link from "next/link";
import { KnowledgeCriticalityToggle } from "@/components/app/learning-inbox-actions";
import { ArrowRight, ChevronDown, Mic, Video } from "lucide-react";
import { OprynArc } from "@/components/opryn/opryn-arc";
import { OprynStatus } from "@/components/opryn/opryn-status";
import {
  ApprovedIcon,
  CallsIcon,
  ConnectionIcon,
  DocumentIcon,
  DriveIcon,
  ExpertIcon,
  TeamIcon,
  type OprynIconProps,
} from "@/components/opryn-icons/opryn-icons";

type SourceId =
  "google_drive" | "owner_answers" | "calls" | "documents" | "video" | "voice";

type KnowledgeSource = {
  id: SourceId;
  label: string;
  count: number;
};

type LifecycleItem = {
  id: string;
  title: string;
  content: string;
  learnedFrom: string;
  observedAt: string;
  approvedBy: string;
  approvedAt: string;
  usedBy: string[];
  answeredQuestions: number;
  version: number;
  lastConfirmed: string;
  usageCount: number;
  versions: Array<{ version: number; content: string; changedAt: string }>;
  processId: string | null;
  knowledgeChunkId: string | null;
  criticality: "normal" | "critical";
  healthStatus: "healthy" | "needs_review" | "conflict";
};

type FilteredKnowledge = {
  id: string;
  content: string;
  sourceLabel: string;
  processId: string | null;
};

const sourceIcons = {
  google_drive: DriveIcon,
  owner_answers: ExpertIcon,
  calls: CallsIcon,
  documents: DocumentIcon,
  video: Video,
  voice: Mic,
} satisfies Record<SourceId, React.ComponentType<OprynIconProps>>;

export function KnowledgeFlow({
  captured,
  observed,
  approved,
  employeeCount,
  roleCount,
  connectionCount,
  sources,
  selectedSource,
  filteredKnowledge,
  lifecycles,
}: {
  captured: number;
  observed: number;
  approved: number;
  employeeCount: number;
  roleCount: number;
  connectionCount: number;
  sources: KnowledgeSource[];
  selectedSource?: SourceId;
  filteredKnowledge: FilteredKnowledge[];
  lifecycles: LifecycleItem[];
}) {
  const selectedLabel = sources.find(
    (source) => source.id === selectedSource,
  )?.label;

  return (
    <>
      <section
        id="knowledge-flow"
        className="opryn-surface mb-7 scroll-mt-24 overflow-hidden"
      >
        <div className="relative overflow-hidden border-b border-white/10 bg-[var(--opryn-navy)] p-5 text-white sm:p-8">
          <p className="text-[11px] font-semibold tracking-[.07em] text-[#8eb6ff]">
            Your knowledge flow
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-.04em]">
                See how Opryn learns—and who can use it.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#bdc8da]">
                Every number comes from this workspace. Only approved knowledge
                reaches employees or connected AI tools.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 border-l border-white/18 pl-3 text-xs font-semibold text-[#dce5f4]">
              <ApprovedIcon size={16} /> Owner controlled
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div id="learning-sources" className="scroll-mt-24">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[.11em] text-[#718095]">
                  Learning sources
                </p>
                <p className="mt-1 text-sm text-[#718095]">
                  Choose a source to see what it taught Opryn.
                </p>
              </div>
              <strong className="text-2xl tracking-[-.04em]">{captured}</strong>
            </div>
            <div className="mt-4 grid border-y border-[var(--opryn-line)] sm:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => {
                const Icon = sourceIcons[source.id];
                const active = source.id === selectedSource;
                return (
                  <Link
                    key={source.id}
                    href={`/app/processes?source=${source.id}#source-knowledge`}
                    className={`flex min-h-[72px] items-center gap-3 border-b border-[var(--opryn-line)] p-3.5 hover:bg-[var(--opryn-blue-surface)] sm:odd:border-r ${active ? "bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)] shadow-[inset_2px_0_0_var(--opryn-blue)]" : "text-[#455269]"}`}
                  >
                    <Icon
                      size={18}
                      className="shrink-0 text-[var(--opryn-blue)]"
                    />
                    <p className="flex-1 text-xs font-semibold">
                      {source.label}
                    </p>
                    <p className="text-lg font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
                      {source.count}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <FlowArrow />

          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-[1fr_32px_1fr_32px_1fr] sm:items-center">
            <StageCard
              label="Captured"
              value={captured}
              copy="Pieces Opryn has received"
              href="#learning-sources"
              tone="neutral"
            />
            <StageArrow />
            <StageCard
              label="Observed"
              value={observed}
              copy="Need owner review"
              href="/app/processes?status=needs_review"
              tone="review"
            />
            <StageArrow />
            <StageCard
              label="Approved"
              value={approved}
              copy="Safe for company answers"
              href="/app/processes?status=approved"
              tone="approved"
            />
          </div>

          <FlowArrow />

          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-4">
            <AudienceCard
              icon={TeamIcon}
              title="Employees"
              value={`${employeeCount} ${employeeCount === 1 ? "person" : "people"}`}
              detail={`${roleCount} ${roleCount === 1 ? "role" : "roles"} with access`}
              href="/app/team"
            />
            <AudienceCard
              icon={ConnectionIcon}
              title="AI Connections"
              value={`${connectionCount} connected`}
              detail="Using approved knowledge only"
              href="/app/integrations?filter=ai"
            />
          </div>
        </div>
      </section>

      {selectedSource ? (
        <section
          id="source-knowledge"
          className="mb-6 scroll-mt-24 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
                Learned from {selectedLabel}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-.03em]">
                {filteredKnowledge.length
                  ? `${filteredKnowledge.length} approved ${filteredKnowledge.length === 1 ? "item" : "items"}`
                  : "Nothing approved from this source yet"}
              </h2>
            </div>
            <Link
              href="/app/processes"
              className="text-xs font-semibold text-[#718095] hover:text-[#3158d8]"
            >
              Clear source filter
            </Link>
          </div>
          {filteredKnowledge.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {filteredKnowledge.slice(0, 12).map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-[#e2e7ed] bg-[#fafbfd] p-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#718095]">
                    {item.sourceLabel}
                  </p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-[#455269]">
                    {item.content}
                  </p>
                  {item.processId ? (
                    <Link
                      href={`/app/processes/${item.processId}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#3158d8]"
                    >
                      Open process <ArrowRight className="size-3" />
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl bg-[#f7f9fc] p-5 text-sm text-[#718095]">
              <p>
                Teach Opryn from this source, then approve what it learns. The
                approved knowledge will appear here.
              </p>
              {selectedSource === "google_drive" ? (
                <Link
                  href="/app/integrations?provider=google_drive"
                  className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#3158d8] px-4 text-xs font-semibold text-white"
                >
                  Connect Google Workspace
                </Link>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {lifecycles.length ? (
        <section className="mb-6 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#718095]">
              Knowledge lifecycle
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-.03em]">
              See where a rule came from and where it is used.
            </h2>
          </div>
          <div className="mt-5 space-y-3">
            {lifecycles.map((item) => (
              <details
                key={item.id}
                id={`knowledge-${item.id}`}
                className="group scroll-mt-24 rounded-xl border border-[#e0e5ec] bg-[#fafbfd] target:border-[#3158d8] target:ring-4 target:ring-[#3158d8]/10 open:bg-white"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden">
                  <OprynArc size={34} progress={100} state="approved" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {item.title}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-[#718095]">
                      {item.content}
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-[#8a95a5] transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-[#e8ecf1] px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <LifecycleFact
                      label="Learned from"
                      value={item.learnedFrom}
                    />
                    <LifecycleFact label="Observed" value={item.observedAt} />
                    <LifecycleFact
                      label="Approved by"
                      value={`${item.approvedBy} · ${item.approvedAt}`}
                    />
                    <LifecycleFact
                      label="Answered questions"
                      value={String(item.answeredQuestions)}
                    />
                    <LifecycleFact
                      label="Current version"
                      value={`Version ${item.version}`}
                    />
                  </div>
                  <p className="mt-3 text-xs text-[#718095]">
                    Last confirmed {item.lastConfirmed} · Used {item.usageCount}{" "}
                    times
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <OprynStatus
                      kind={
                        item.healthStatus === "healthy"
                          ? "approved"
                          : item.healthStatus === "conflict"
                            ? "needs-you"
                            : "observed"
                      }
                      label={
                        item.healthStatus === "healthy"
                          ? "Healthy"
                          : item.healthStatus === "conflict"
                            ? "Conflict"
                            : "Needs Review"
                      }
                    />
                    {item.criticality === "critical" ? (
                      <span className="rounded-full bg-[#fff0f1] px-2.5 py-1 text-[10px] font-bold uppercase text-[#a3424b]">
                        Critical
                      </span>
                    ) : null}
                    {item.knowledgeChunkId ? (
                      <KnowledgeCriticalityToggle
                        knowledgeId={item.knowledgeChunkId}
                        critical={item.criticality === "critical"}
                      />
                    ) : null}
                  </div>
                  {item.versions.length > 1 ? (
                    <details className="mt-3 rounded-xl border border-[#e4e8ee] bg-white p-3.5">
                      <summary className="cursor-pointer text-xs font-semibold text-[#3158d8]">
                        View version history
                      </summary>
                      <div className="mt-3 space-y-3">
                        {[...item.versions].reverse().map((version) => (
                          <div
                            key={version.version}
                            className="border-t border-[#edf0f4] pt-3 first:border-0 first:pt-0"
                          >
                            <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8290a3]">
                              Version {version.version} · {version.changedAt}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#536176]">
                              {version.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  <div className="mt-3 rounded-xl bg-[#f3f6fa] p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[.09em] text-[#718095]">
                      Used by
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.usedBy.length ? (
                        item.usedBy.map((consumer) => (
                          <span
                            key={consumer}
                            className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#53627a] shadow-sm"
                          >
                            {consumer}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#7a8698]">
                          Available as approved company knowledge
                        </span>
                      )}
                    </div>
                  </div>
                  {item.processId ? (
                    <Link
                      href={`/app/processes/${item.processId}`}
                      className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#3158d8]"
                    >
                      View source process <ArrowRight className="size-3" />
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function FlowArrow() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex h-10 w-8 flex-col items-center"
    >
      <span className="h-7 w-px bg-[#c9d3df]" />
      <span className="size-2 rotate-45 border-b border-r border-[#9eacbd]" />
    </div>
  );
}

function StageArrow() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex h-6 w-6 rotate-90 items-center justify-center sm:rotate-0"
    >
      <span className="h-px w-5 bg-[#c9d3df]" />
      <span className="-ml-1 size-2 rotate-[-45deg] border-b border-r border-[#9eacbd]" />
    </div>
  );
}

function StageCard({
  label,
  value,
  copy,
  href,
  tone,
}: {
  label: string;
  value: number;
  copy: string;
  href: string;
  tone: "neutral" | "review" | "approved";
}) {
  const state =
    tone === "review"
      ? "observed"
      : tone === "approved"
        ? "approved"
        : "unknown";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border border-[var(--opryn-line)] bg-white p-4 text-left hover:border-[#a8bddb] hover:bg-[var(--opryn-blue-surface)]"
    >
      <OprynArc
        size={38}
        progress={tone === "approved" ? 100 : tone === "review" ? 62 : 32}
        state={state}
      />
      <div>
        <p className="text-[10px] font-semibold tracking-[.07em] text-[var(--opryn-muted)]">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[var(--opryn-navy)]">
          {value}
        </p>
        <p className="mt-1 text-[11px] text-[var(--opryn-muted)]">{copy}</p>
      </div>
    </Link>
  );
}

function AudienceCard({
  icon: Icon,
  title,
  value,
  detail,
  href,
}: {
  icon: React.ComponentType<OprynIconProps>;
  title: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 border border-[var(--opryn-line)] bg-[#fafbfd] p-4 text-left hover:border-[#9fb6d6] hover:bg-[var(--opryn-blue-surface)]"
    >
      <span className="grid size-10 shrink-0 place-items-center border-r border-[var(--opryn-line)] pr-3 text-[var(--opryn-blue)]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-1 block text-lg font-semibold tracking-[-.03em]">
          {value}
        </span>
        <span className="mt-0.5 block text-[11px] text-[#7a8698]">
          {detail}
        </span>
      </span>
    </Link>
  );
}

function LifecycleFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e4e8ee] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8a95a5]">
        {label}
      </p>
      <p className="mt-1.5 text-xs font-semibold leading-5 text-[#455269]">
        {value}
      </p>
    </div>
  );
}
