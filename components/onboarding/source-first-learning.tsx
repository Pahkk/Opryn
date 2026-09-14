"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { SourceImport } from "@/components/onboarding/source-import";
import { TeachGoogle } from "@/components/app/teach-google";

type Provider = "chatgpt" | "claude";
type Intent = {
  provider: Provider;
  type: "business" | "process" | "topic";
  name: string;
  stage: "type" | "name" | "request" | "waiting";
  since?: string;
};
type Job = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  requestedAt?: string;
  processId?: string;
  summary: Record<string, number>;
  findings?: string[];
  questions?: string[];
  approved?: boolean;
};
const button =
  "inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#146bff] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0d59d9] active:scale-[.99] motion-reduce:transform-none";
const secondary =
  "inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#dbe3ee] bg-white px-5 py-3 text-sm font-semibold transition hover:bg-[#f3f7ff]";

export function SourceFirstLearning({
  organizationId,
  name,
  connected,
  onExplain,
  onConnect,
  onTestComplete,
}: {
  organizationId: string;
  name: string;
  connected: Record<string, boolean>;
  onExplain: () => void;
  onConnect: (provider: Provider) => void;
  onTestComplete?: () => void;
}) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [ready, setReady] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [imports, setImports] = useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [answer, setAnswer] = useState<{
    headline: string;
    text: string;
    sources: Array<{ label: string; href: string }>;
  } | null>(null);
  const [importMode, setImportMode] = useState<"documents" | "drive" | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/onboarding/learning-session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!cancelled) {
          setIntent(data.intent);
          setImports(data.imports || []);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled)
          setNotice(
            "Your saved request couldn't be loaded. Refresh to try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      void saveIntent(intent);
    }, 350);
    return () => clearTimeout(timer);
  }, [intent, ready]);
  async function saveIntent(value: Intent | null, event?: string) {
    try {
      const response = await fetch("/api/onboarding/learning-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: value, event }),
        keepalive: true,
      });
      if (!response.ok) throw new Error();
    } catch {
      setNotice(
        "Your latest change hasn't saved yet. Keep this page open and try again.",
      );
    }
  }
  useEffect(() => {
    if (!intent || intent.stage !== "waiting") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(
          `/api/onboarding/ai-connections/status?provider=${intent!.provider}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (cancelled) return;
        const next = data.latestLearning as Job | null;
        if (
          next &&
          next.name.toLowerCase() === intent!.name.toLowerCase() &&
          (!intent!.since ||
            (next.requestedAt || next.createdAt) >= intent!.since)
        )
          setJob(next);
        setNotice(
          data.learningEnabled
            ? ""
            : "Reconnect Opryn once to enable conversation learning.",
        );
      } catch {
        if (!cancelled)
          setNotice(
            "We couldn't check yet. Your request is saved; we'll try again.",
          );
      }
      if (!cancelled) timer = setTimeout(poll, 3500);
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intent]);

  const providerName = intent?.provider === "claude" ? "Claude" : "ChatGPT";
  const request = !intent
    ? ""
    : intent.provider === "chatgpt"
      ? `@Opryn /learn ${intent.type === "business" ? "" : `${intent.type} `}${intent.name}`
      : intent.type === "business"
        ? `Use Opryn to learn ${intent.name} from this conversation.`
        : `Use Opryn to learn ${intent.type === "process" ? `our ${intent.name} process` : `what this conversation says about ${intent.name}`} from this conversation.`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
    } catch {
      setNotice("Select and copy the request below.");
    }
  }
  async function testQuestion(question: string) {
    setTesting(true);
    setAnswer(null);
    setNotice("");
    void saveIntent(intent, "first_suggested_question_used");
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history: [], image: null }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          "Opryn couldn't answer right now. Try again in a moment.",
        );
      if (body.type !== "answer") {
        setNotice(
          "Opryn doesn't have an approved answer for that yet. Review the source and add any missing detail.",
        );
        return;
      }
      setAnswer({
        headline: body.headline || "Based on approved company knowledge",
        text: body.answer,
        sources: (body.sources || []).filter(
          (source: { href?: string }) =>
            typeof source.href === "string" && source.href.startsWith("/app/"),
        ),
      });
      const saved = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentStep: "invite",
          completedStep: "test",
          firstTestQuestion: question,
          firstTestAnswered: true,
          event: "first_test_question",
          eventMetadata: { answered: true, source: intent?.provider },
        }),
      });
      if (!saved.ok)
        setNotice(
          "Your answer is ready, but setup progress couldn't be saved. Try the question again before leaving.",
        );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setTesting(false);
    }
  }
  function open() {
    if (!intent) return;
    const next = {
      ...intent,
      stage: "waiting" as const,
      since: intent.since || new Date().toISOString(),
    };
    // Save before switching apps, including on mobile browsers that suspend this page.
    void saveIntent(next, "external_ai_learn_started");
    setIntent(next);
    window.open(
      intent.provider === "claude"
        ? "https://claude.ai"
        : "https://chatgpt.com",
      "_blank",
      "noopener,noreferrer",
    );
    void copy();
  }
  const complete = job && ["needs_review", "complete"].includes(job.status);
  const stages = [
    "Context received",
    "Reading business context",
    "Identifying processes and rules",
    "Organizing findings",
    "Ready for review",
  ];
  const active = job
    ? ({
        received: 0,
        processing: 1,
        extracting: 2,
        organizing: 3,
        needs_review: 4,
        complete: 4,
      }[job.status] ?? 0)
    : -1;

  if (!ready)
    return (
      <p role="status">{notice || "Getting your learning sources ready…"}</p>
    );
  if (importMode)
    return (
      <SourceImport mode={importMode} onBack={() => setImportMode(null)} />
    );
  return (
    <section
      className="source-first-learning"
      aria-label="Learn from existing sources"
    >
      <p className="text-sm font-bold text-[#146bff]">
        Learn from what you already use
      </p>
      <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-[-.045em] sm:text-5xl">
        {!intent
          ? "Teach Opryn from what you already use."
          : intent.stage === "type"
            ? "What should Opryn learn?"
            : intent.stage === "name"
              ? intent.type === "business"
                ? "What should we call this business context?"
                : "What should Opryn focus on?"
              : complete
                ? `${job.name}: findings ready for review.`
                : job
                  ? "Opryn is learning."
                  : intent.stage === "waiting"
                    ? `Waiting for ${intent.name}…`
                    : `Continue in ${providerName}`}
      </h1>
      {!intent ? (
        <>
          <p className="mt-4 text-lg leading-7 text-[#52627a]">
            Start with the tools and information your business already uses.
            Opryn will help organize what it learns.
          </p>
          <div className="mt-8 divide-y divide-[#e2e8f0]">
            {(["chatgpt", "claude"] as const)
              .filter((provider) => connected[provider])
              .map((provider) => (
                <div
                  key={provider}
                  className="flex flex-wrap items-center justify-between gap-4 py-6"
                >
                  <div className="flex items-center gap-4">
                    <ProviderLogo
                      id={provider}
                      name={provider === "claude" ? "Claude" : "ChatGPT"}
                    />
                    <div>
                      <h2 className="text-xl font-bold">
                        {provider === "claude" ? "Claude" : "ChatGPT"}{" "}
                        <span className="ml-2 text-xs font-semibold text-[#146bff]">
                          Authorized
                        </span>
                      </h2>
                      <p className="mt-1 max-w-md text-sm text-[#52627a]">
                        Learn from a conversation you&apos;ve already used to
                        explain your business.
                      </p>
                    </div>
                  </div>
                  <button
                    className={button}
                    onClick={() => {
                      setJob(null);
                      setAnswer(null);
                      setNotice("");
                      setCopied(false);
                      setIntent({
                        provider,
                        type: "business",
                        name,
                        stage: "type",
                      });
                      void saveIntent(
                        { provider, type: "business", name, stage: "type" },
                        "learning_source_opened",
                      );
                    }}
                  >
                    Learn from {provider === "claude" ? "Claude" : "ChatGPT"}
                  </button>
                </div>
              ))}
            <TeachGoogle
              organizationId={organizationId}
              organizationName={name}
            />
            <SourceRow
              title="Images & documents"
              description="Upload photos, screenshots, PDFs, Word documents, or saved text. Review what Opryn finds."
              action="Upload"
              onClick={() => setImportMode("documents")}
            />
            <SourceRow
              title="Explain It"
              description="Tell Opryn something yourself using voice or text."
              action="Speak or Type"
              onClick={onExplain}
            />
          </div>
          {imports.length ? (
            <div className="mt-8">
              <h2 className="text-2xl font-bold">
                Pick up where you left off.
              </h2>
              {imports.map((item) => (
                <div
                  className="mt-3 rounded-2xl border border-[#dbe3ee] p-5"
                  key={item.id}
                >
                  <h3 className="font-bold">{item.title}</h3>
                  {item.status === "approved" ? (
                    <button
                      className={`${secondary} mt-3`}
                      disabled={testing}
                      onClick={() =>
                        void testQuestion(
                          `What should I know about ${item.title}?`,
                        )
                      }
                    >
                      Ask Opryn about this
                    </button>
                  ) : (
                    <Link
                      className={`${secondary} mt-3`}
                      href={`/app/processes/${item.id}?returnTo=${encodeURIComponent("/onboarding?step=teach")}`}
                    >
                      Review Findings
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          {testing ? (
            <p role="status" className="mt-4">
              Checking approved company knowledge…
            </p>
          ) : null}
          {answer ? (
            <div className="mt-5 rounded-3xl bg-[#f3f7ff] p-6">
              <h2 className="text-xl font-bold">{answer.headline}</h2>
              <p className="mt-3 leading-7">{answer.text}</p>
              {answer.sources.map((source) => (
                <Link
                  key={source.href}
                  href={source.href}
                  className="mt-3 block text-sm font-semibold text-[#146bff]"
                >
                  {source.label}
                </Link>
              ))}
              <h3 className="mt-5 text-xl font-bold">
                Your team can ask Opryn this now.
              </h3>
              <button className={`${button} mt-5`} onClick={onTestComplete}>
                Continue
              </button>
            </div>
          ) : null}
          {notice ? (
            <p role="status" className="mt-4 text-sm">
              {notice}
            </p>
          ) : null}
        </>
      ) : (
        <>
          {intent.stage === "type" ? (
            <div className="mt-8 space-y-3">
              {(
                [
                  [
                    "business",
                    "My Business",
                    "Build a broad understanding of how your company works.",
                  ],
                  [
                    "process",
                    "A Process",
                    "Teach Opryn how one part of your business works.",
                  ],
                  [
                    "topic",
                    "A Topic",
                    "Focus on one area, such as pricing, clients, or sales.",
                  ],
                ] as const
              ).map(([type, title, description]) => (
                <button
                  key={type}
                  className="w-full rounded-3xl border border-[#dbe3ee] bg-white p-6 text-left transition hover:border-[#85b4f5] hover:bg-[#f3f7ff]"
                  onClick={() => {
                    const next: Intent = {
                      ...intent,
                      type,
                      name: type === "business" ? name : "",
                      stage: "name",
                    };
                    setIntent(next);
                    void saveIntent(next, "learning_type_selected");
                  }}
                >
                  <strong className="text-xl">{title}</strong>
                  <span className="mt-2 block text-[#52627a]">
                    {description}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {intent.stage === "name" ? (
            <div className="mt-8">
              <label className="block font-semibold">
                {intent.type === "business"
                  ? "Business name"
                  : intent.type === "process"
                    ? "Process name"
                    : "Topic"}
                <input
                  autoFocus
                  value={intent.name}
                  maxLength={200}
                  onChange={(event) =>
                    setIntent({ ...intent, name: event.target.value })
                  }
                  className="onboarding-input mt-3"
                />
              </label>
              {intent.type !== "business" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(intent.type === "process"
                    ? [
                        "Client onboarding",
                        "Website revisions",
                        "Customer refunds",
                        "Sales calls",
                      ]
                    : [
                        "Pricing",
                        "Refunds",
                        "Client communication",
                        "Sales",
                        "Scheduling",
                        "Contracts",
                      ]
                  ).map((value) => (
                    <button
                      className={secondary}
                      key={value}
                      onClick={() => setIntent({ ...intent, name: value })}
                    >
                      {value}
                    </button>
                  ))}
                  <p className="w-full text-xs text-[#52627a]">
                    These are focus suggestions, not company policies.
                  </p>
                </div>
              ) : null}
              <button
                disabled={!intent.name.trim()}
                className={`${button} mt-6 disabled:opacity-50`}
                onClick={() =>
                  setIntent({
                    ...intent,
                    name: intent.name.trim(),
                    stage: "request",
                  })
                }
              >
                Continue
              </button>
            </div>
          ) : null}
          {intent.stage === "request" || intent.stage === "waiting" ? (
            <div className="mt-7 space-y-5">
              <div
                className="learning-handoff flex items-center gap-4 text-sm font-bold"
                aria-label={`${providerName} sends your selected context to Opryn`}
              >
                <ProviderLogo id={intent.provider} name={providerName} />
                {providerName}
                <svg
                  width="100"
                  height="40"
                  viewBox="0 0 100 40"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 30C35 30 30 10 65 10H94M87 4l7 6-7 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Opryn
              </div>
              {!job ? (
                <>
                  <p className="text-lg leading-7 text-[#52627a]">
                    Send this prepared request in a {providerName} conversation
                    that contains useful business context. Opryn will update
                    this screen when it receives it.
                  </p>
                  <blockquote className="rounded-3xl border border-[#dbe3ee] bg-[#f3f7ff] p-6 text-lg font-semibold break-words">
                    {request}
                  </blockquote>
                  <div className="flex flex-wrap gap-3">
                    <button className={button} onClick={open}>
                      Open {providerName}
                    </button>
                    <button className={secondary} onClick={() => void copy()}>
                      {copied ? "Copied" : "Copy Request"}
                    </button>
                    {intent.stage === "waiting" ? (
                      <button
                        className={secondary}
                        onClick={() =>
                          setNotice(
                            "We're checking automatically. Keep this page open or return later.",
                          )
                        }
                      >
                        I&apos;ve Sent It
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-[#52627a]">
                    Only the context you intentionally send is stored in your
                    company workspace. Opryn does not read your other
                    conversations.
                  </p>
                </>
              ) : job.status === "failed" ? (
                <p role="alert">
                  Opryn couldn&apos;t organize this context. Open {providerName}{" "}
                  and send the request again.
                </p>
              ) : (
                <>
                  <p className="text-[#52627a]">
                    {complete
                      ? "Opryn organized what it found. Review the important parts before your team relies on them."
                      : `${job.name} received from ${providerName}. You can leave this page and come back.`}
                  </p>
                  <ol className="space-y-3" aria-live="polite">
                    {stages.map((label, index) => (
                      <li
                        key={label}
                        className={
                          index <= active
                            ? "font-semibold text-[#175fc3]"
                            : "text-[#69778a]"
                        }
                      >
                        {index < active || complete
                          ? "✓"
                          : index === active
                            ? "→"
                            : "○"}{" "}
                        {label}
                      </li>
                    ))}
                  </ol>
                  {complete ? (
                    <>
                      <div className="flex flex-wrap gap-x-8 gap-y-4 rounded-3xl bg-[#f3f7ff] p-6">
                        {[
                          ["processes", "Processes"],
                          ["rules", "Possible rules"],
                          ["faqs", "Common answers"],
                          ["clarifications", "Clarifications"],
                        ].map(([key, label]) => (
                          <div key={key}>
                            <strong className="block text-3xl">
                              {job.summary[key] || 0}
                            </strong>
                            <span className="text-sm">{label}</span>
                          </div>
                        ))}
                      </div>
                      {job.findings?.map((title) => (
                        <p
                          className="border-b border-[#e2e8f0] py-3 font-semibold"
                          key={title}
                        >
                          {title}
                          <span className="ml-3 text-xs text-[#94631e]">
                            {job.approved ? "Approved" : "Needs Review"}
                          </span>
                        </p>
                      ))}
                      <Link
                        className={button}
                        href={`/app/processes/${job.processId}?returnTo=${encodeURIComponent("/onboarding?step=teach")}`}
                        onClick={() =>
                          void saveIntent(intent, "learning_review_opened")
                        }
                      >
                        Review What Opryn Learned
                      </Link>
                      {job.approved ? (
                        <div>
                          <h2 className="text-xl font-bold">
                            Try what Opryn learned.
                          </h2>
                          {job.questions?.map((question) => (
                            <button
                              key={question}
                              className={`${secondary} mt-3 w-full justify-start text-left`}
                              disabled={testing}
                              onClick={() => void testQuestion(question)}
                            >
                              {question}
                            </button>
                          ))}
                          {testing ? (
                            <p role="status" className="mt-4">
                              Checking approved company knowledge…
                            </p>
                          ) : null}
                          {answer ? (
                            <div
                              className="mt-6 rounded-3xl bg-[#f3f7ff] p-6"
                              role="status"
                            >
                              <h3 className="text-xl font-bold">
                                {answer.headline}
                              </h3>
                              <p className="mt-3 leading-7">{answer.text}</p>
                              {answer.sources.map((source) => (
                                <Link
                                  key={source.href}
                                  href={source.href}
                                  className="mt-3 block text-sm font-semibold text-[#146bff]"
                                >
                                  {source.label}
                                </Link>
                              ))}
                              <h3 className="mt-6 text-xl font-bold">
                                Your team can ask Opryn this now.
                              </h3>
                              <p className="mt-2 text-[#52627a]">
                                One less question that needs you.
                              </p>
                              <button
                                className={`${button} mt-5`}
                                onClick={onTestComplete}
                              >
                                Continue
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-[#52627a]">
                          Approve the findings first, then return here to try a
                          question.
                        </p>
                      )}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
          {notice ? (
            <p role="status" className="mt-4 text-sm text-[#52627a]">
              {notice}
              {notice.startsWith("Reconnect") ? (
                <button
                  className={secondary}
                  onClick={() => onConnect(intent.provider)}
                >
                  Reconnect
                </button>
              ) : null}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              className={secondary}
              onClick={() => {
                setIntent(null);
                setJob(null);
                setAnswer(null);
                setNotice("");
              }}
            >
              Back to Sources
            </button>
            <Link
              href="/app"
              className="inline-flex min-h-12 items-center text-sm font-semibold text-[#52627a]"
            >
              Do This Later
            </Link>
          </div>
        </>
      )}
    </section>
  );
}

function SourceRow({
  title,
  description,
  action,
  href,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-6">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-[#52627a]">{description}</p>
      </div>
      {href ? (
        <Link className={secondary} href={href}>
          {action}
        </Link>
      ) : (
        <button className={secondary} onClick={onClick}>
          {action}
        </button>
      )}
    </div>
  );
}
