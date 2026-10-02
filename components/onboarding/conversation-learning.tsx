"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { ConnectionGuide } from "@/components/connections/connection-guide";
import { DialogSurface } from "@/components/app/dialog-surface";
import { MotionButton } from "@/components/motion/motion-button";
import { MotionRegion } from "@/components/motion/motion-region";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import {
  conversationIntentSchema,
  conversationRequest,
  conversationProcessing,
  type ConversationIntent,
  type ConversationProvider,
} from "@/lib/onboarding/conversation-learning";
import "./conversation-learning.css";
import { PlanChoice } from "./plan-choice";
import { providerLearningCapabilities } from "@/lib/onboarding/provider-capabilities";

type Job = {
  id: string;
  name: string;
  status: string;
  processId: string | null;
  summary: Record<string, unknown>;
  error?: string | null;
  requestedAt?: string;
  createdAt: string;
  approved?: boolean;
};
type Status = {
  entitlement: { feature: string; enabled: boolean };
  requiresConfirmation?: boolean;
  requestExpired?: boolean;
  connected: boolean;
  learningEnabled: boolean;
  latestLearning: Job | null;
};
export function ConversationLearning({
  organizationId,
  companyName,
  onPrepared,
  providerFilter,
}: {
  organizationId: string;
  companyName: string;
  onPrepared: (id: string) => void;
  providerFilter?: ConversationProvider;
}) {
  const [statuses, setStatuses] = useState<
    Partial<Record<ConversationProvider, Status>>
  >({});
  const [intent, setIntent] = useState<ConversationIntent | null>(null);
  const [setup, setSetup] = useState<ConversationProvider | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState<Job | null>(null);
  const [confirmedJobId, setConfirmedJobId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [receiptCheck, setReceiptCheck] = useState(0);
  const [upgrade, setUpgrade] = useState<ConversationProvider | null>(null);
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [unsupported, setUnsupported] = useState<ConversationProvider | null>(
    null,
  );
  const pending = useRef(false);
  const savedIntentRef = useRef<ConversationIntent | null>(null);
  const headers = {
    "content-type": "application/json",
    "x-opryn-organization": organizationId,
  };
  useEffect(() => {
    const controller = new AbortController();
    const statusHeaders = { "x-opryn-organization": organizationId };
    async function load() {
      try {
        const results = await Promise.all(
          (["chatgpt", "claude"] as const).map(async (provider) => {
            const response = await fetch(
              `/api/onboarding/ai-connections/status?provider=${provider}`,
              {
                headers: statusHeaders,
                signal: controller.signal,
                cache: "no-store",
              },
            );
            if (!response.ok)
              throw new Error(
                "Opryn couldn't check your connections. Try again.",
              );
            return [provider, await response.json()] as const;
          }),
        );
        if (!controller.signal.aborted)
          setStatuses(Object.fromEntries(results));
      } catch (error) {
        if (!controller.signal.aborted)
          setNotice(
            error instanceof Error
              ? error.message
              : "Couldn't check connections.",
          );
      }
    }
    void load();
    void fetch("/api/onboarding/learning-session", {
      headers: statusHeaders,
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const body = await response.json();
        const saved = conversationIntentSchema.safeParse(body.intent);
        if (
          !controller.signal.aborted &&
          saved.success &&
          (!providerFilter || saved.data.provider === providerFilter)
        )
          setIntent(saved.data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNotice(
            "Your saved learning request couldn't load. You can start a new one here.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [organizationId, providerFilter, statusRefresh]);
  useEffect(() => {
    if (!intent || intent.stage !== "waiting") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const query = new URLSearchParams({
            provider: intent!.provider,
            name: intent!.name,
            ...(intent!.since ? { since: intent!.since } : {}),
            ...(intent!.requestId ? { requestId: intent!.requestId } : {}),
          });
          const response = await fetch(
            `/api/onboarding/ai-connections/status?${query}`,
            {
              headers: { "x-opryn-organization": organizationId },
              signal: controller.signal,
              cache: "no-store",
            },
          );
          if (!response.ok) throw new Error();
          const data: Status = await response.json();
          if (controller.signal.aborted) return;
          setStatuses((current) => ({ ...current, [intent!.provider]: data }));
          setExpired(!!data.requestExpired);
          if (
            data.requiresConfirmation &&
            data.latestLearning?.id !== confirmedJobId
          ) {
            setCandidate(data.latestLearning);
            setJob(null);
          } else {
            setCandidate(null);
            setJob(data.latestLearning);
          }
          if (!data.connected || !data.learningEnabled)
            setNotice(
              "Finish connection setup before sending this conversation.",
            );
        } catch {
          if (!controller.signal.aborted)
            setNotice(
              "Couldn't check for the conversation yet. Your request is saved; we'll try again.",
            );
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [intent, organizationId, confirmedJobId, receiptCheck]);
  async function save(next: ConversationIntent | null, event?: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/onboarding/learning-session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          intent: next,
          event,
          ...(event === "external_ai_learn_started" && next
            ? {
                metric:
                  next.stage === "request"
                    ? "ai_learning_handoff_created"
                    : `${next.provider}_learn_started`,
              }
            : {}),
        }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      const stored = result.intent === undefined ? next : result.intent;
      savedIntentRef.current = stored;
      setIntent(stored);
      setCopied(false);
      return true;
    } catch {
      setNotice(
        "Your request hasn't saved. Keep this page open and try again.",
      );
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const providerName = intent?.provider === "claude" ? "Claude" : "ChatGPT";
  function track(
    provider: ConversationProvider,
    event: string,
    metric: string,
  ) {
    // Best-effort, metadata-only analytics must never block connection or review.
    void fetch("/api/onboarding/learning-session", {
      method: "POST",
      headers,
      body: JSON.stringify({ provider, event, metric }),
      keepalive: true,
    }).catch(() => undefined);
  }
  function openSetup(provider: ConversationProvider) {
    track(provider, "integration_selected", `${provider}_connect_started`);
    if (!intent)
      void save({
        provider,
        type: "business",
        name: companyName,
        stage: "type",
      });
    setSetup(provider);
  }
  const request = intent ? conversationRequest(intent) : "";
  const finished = job && ["needs_review", "complete"].includes(job.status);
  const processing = job
    ? conversationProcessing[job.status as keyof typeof conversationProcessing]
    : null;
  async function copy(instruction = request) {
    try {
      await navigator.clipboard.writeText(instruction);
      setCopied(true);
      if (intent)
        track(
          intent.provider,
          "external_ai_learn_started",
          "instruction_copied",
        );
    } catch {
      setNotice("Select and copy the prepared request below.");
    }
  }
  async function continueInProvider() {
    if (!intent) return;
    // Open during the click to avoid popup blocking, but never navigate before
    // the pending intent is durably saved. No conversation is sent by this UI.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    const next = {
      ...intent,
      stage: "waiting" as const,
      since: new Date().toISOString(),
    };
    if (!(await save(next, "external_ai_learn_started"))) {
      popup?.close();
      return;
    }
    setJob(null);
    track(intent.provider, "external_ai_learn_started", "provider_opened");
    await copy(conversationRequest(savedIntentRef.current || next));
    const url =
      intent.provider === "claude"
        ? "https://claude.ai"
        : "https://chatgpt.com";
    if (popup) popup.location.href = url;
    else
      setNotice(
        `Your request is saved. Use the Open ${providerName} link below, then paste it in your existing conversation.`,
      );
  }
  function start(provider: ConversationProvider) {
    setJob(null);
    setNotice("");
    setOpen(true);
    if (intent?.provider === provider) return;
    void save(
      { provider, type: "business", name: companyName, stage: "type" },
      "learning_source_opened",
    );
  }
  return (
    <section className="conversation-sources" aria-label="Conversation sources">
      {!providerFilter && (
        <h3>Already taught ChatGPT or Claude about your business?</h3>
      )}
      {(["chatgpt", "claude"] as const)
        .filter((provider) => !providerFilter || provider === providerFilter)
        .map((provider) => {
          const name = provider === "claude" ? "Claude" : "ChatGPT";
          const state = statuses[provider];
          return (
            <div
              className="conversation-source-row"
              key={provider}
              data-guide-target={`onboarding.${provider}`}
            >
              <ProviderLogo id={provider} name={name} />
              <div>
                <h2>{name}</h2>
                <span className="conversation-premium-badge">Pro</span>
                <p>Teach Opryn from a conversation you already have.</p>
                <small>
                  {!state
                    ? "Checking connection…"
                    : state.connected && state.learningEnabled
                      ? "Connected"
                      : "Needs setup"}
                </small>
              </div>
              <div className="conversation-row-actions">
                <MotionButton
                  disabled={
                    busy ||
                    !state ||
                    !ready ||
                    (unsupported === provider && !!state?.entitlement?.enabled)
                  }
                  onClick={async () => {
                    if (!state?.entitlement?.enabled) {
                      track(provider, "integration_selected", "premium_ai_learning_upgrade_started");
                      await save(
                        {
                          provider,
                          type: "business",
                          name: companyName,
                          stage: "type",
                        },
                        "learning_source_opened",
                      );
                      setOpen(false);
                      setUpgrade(provider);
                      return;
                    }
                    if (state?.connected && state.learningEnabled) start(provider);
                    else openSetup(provider);
                  }}
                >
                  {!state?.entitlement?.enabled
                    ? "Unlock with Pro"
                    : state?.connected && state.learningEnabled
                      ? `Learn from ${name}`
                      : state?.connected
                        ? "Finish setup"
                        : `Connect ${name}`}
                </MotionButton>
                <Link href="/app/integrations">Manage</Link>
              </div>
            </div>
          );
        })}
      {providerFilter && (
        <div className="conversation-compatibility">
          <strong>Provider compatibility is separate</strong>
          <p>{providerLearningCapabilities[providerFilter].notice}</p>
          <button
            onClick={() => setUnsupported(unsupported ? null : providerFilter)}
          >
            {unsupported
              ? "Show setup again"
              : "The learning action isn’t available in my account"}
          </button>
          {unsupported && (
            <p role="status">
              Use another source with “Choose a different source” above: Claude,
              Google Workspace, Upload something, or Explain it. You do not need
              to upgrade your external provider plan.
            </p>
          )}
        </div>
      )}
      {upgrade ? (
        <DialogSurface
          onClose={() => {
            setUpgrade(null);
          }}
          labelledBy="conversation-premium-title"
        >
          <div className="dialog-content conversation-learning-sheet">
            <h2 id="conversation-premium-title">
              Unlock conversation learning
            </h2>
            <p>
              Teach Opryn from conversations you explicitly send from supported
              ChatGPT or Claude connections. Your setup is saved; return here
              after billing confirmation.
            </p>
            <PlanChoice
              organizationId={organizationId}
              requiredFeature="ai_conversation_learning"
              onComplete={() => {
                setUpgrade(null);
                setStatusRefresh((value) => value + 1);
                setOpen(true);
              }}
            />
            <button
              className="activation-back"
              onClick={() => setUpgrade(null)}
            >
              Not now
            </button>
          </div>
        </DialogSurface>
      ) : setup ? (
        <ConnectionGuide
          provider={setup}
          organizationId={organizationId}
          organizationName={companyName}
          connected={statuses[setup]?.connected}
          initialMode="connect"
          onConnected={() => {
            const provider = setup;
            track(provider, "integration_connected", `${provider}_connected`);
            setStatuses((current) => ({
              ...current,
              [provider]: {
                connected: true,
                learningEnabled: true,
                entitlement: current[provider]?.entitlement ?? {
                  feature: "ai_conversation_learning",
                  enabled: false,
                },
                latestLearning: null,
              },
            }));
            setSetup(null);
            start(provider);
          }}
          onClose={() => setSetup(null)}
        />
      ) : intent &&
        open &&
        statuses[intent.provider]?.entitlement?.enabled &&
        !unsupported ? (
        <DialogSurface
          onClose={() => {
            setOpen(false);
          }}
          labelledBy="conversation-learning-title"
          busy={busy}
        >
          <div className="dialog-content conversation-learning-sheet">
            <header>
              <ProviderLogo id={intent.provider} name={providerName} />
              <strong>{providerName} conversation</strong>
              <button
                aria-label="Close conversation learning"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                }}
              >
                ×
              </button>
            </header>
            <MotionRegion
              variant="step"
              changeKey={
                intent.stage === "waiting"
                  ? job?.status || "waiting"
                  : intent.stage
              }
            >
              <p className="activation-eyebrow">
                {finished
                  ? "Ready for review"
                  : intent.stage === "request"
                    ? "Ready"
                    : "Only the conversation you send"}
              </p>
              <h2 id="conversation-learning-title">
                {intent.stage === "type"
                  ? "What should Opryn learn?"
                  : intent.stage === "name"
                    ? intent.type === "business"
                      ? "What should I call this business knowledge?"
                      : intent.type === "process"
                        ? "What process is this conversation about?"
                        : "What topic should Opryn learn?"
                    : finished
                      ? "Opryn found useful knowledge."
                      : job
                        ? "Learning from your conversation"
                        : intent.stage === "waiting"
                          ? `Waiting for ${providerName}…`
                          : `Teach Opryn about ${intent.name}`}
              </h2>
              {intent.stage === "type" ? (
                <div className="conversation-type-list">
                  {(
                    [
                      ["business", "My business"],
                      ["process", "A process"],
                      ["topic", "A topic"],
                      ["other", "Something else"],
                    ] as const
                  ).map(([type, label]) => (
                    <MotionButton
                      disabled={busy}
                      key={type}
                      onClick={() =>
                        void save(
                          {
                            ...intent,
                            type: type === "other" ? "general" : type,
                            name: type === "business" ? companyName : "",
                            stage: "name",
                          },
                          "learning_type_selected",
                        )
                      }
                    >
                      {label}
                      <span aria-hidden>→</span>
                    </MotionButton>
                  ))}
                </div>
              ) : intent.stage === "name" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(
                      {
                        ...intent,
                        name: intent.name.trim(),
                        stage: "request",
                      },
                      "external_ai_learn_started",
                    );
                  }}
                >
                  <label>
                    Knowledge name
                    <input
                      required
                      maxLength={200}
                      value={intent.name}
                      onChange={(event) =>
                        setIntent({ ...intent, name: event.target.value })
                      }
                      placeholder={
                        intent.type === "process"
                          ? "Customer onboarding"
                          : "Pricing"
                      }
                    />
                  </label>
                  <MotionButton
                    disabled={busy || !intent.name.trim()}
                    className="activation-primary"
                  >
                    Prepare request →
                  </MotionButton>
                </form>
              ) : (
                <>
                  {candidate ? (
                    <div className="conversation-working">
                      <h3>Is this the conversation you just sent?</h3>
                      <p>
                        {candidate.name} · {providerName} conversation
                      </p>
                      <MotionButton
                        onClick={() => {
                          setConfirmedJobId(candidate.id);
                          setJob(candidate);
                          setCandidate(null);
                        }}
                      >
                        Yes, review this conversation
                      </MotionButton>
                      <MotionButton
                        onClick={() => {
                          setCandidate(null);
                          void save({
                            ...intent,
                            stage: "type",
                            requestId: undefined,
                            expiresAt: undefined,
                            since: undefined,
                          });
                        }}
                      >
                        Use another request
                      </MotionButton>
                    </div>
                  ) : processing ? (
                    <div className="conversation-working" role="status">
                      {processing.orb ? (
                        <OprynThinkingOrb
                          size={64}
                          state={processing.orb}
                          label={processing.label}
                          decorative
                        />
                      ) : null}
                      <strong>{processing.label}</strong>
                      <p>Nothing becomes official until you approve it.</p>
                    </div>
                  ) : finished ? (
                    <>
                      <div className="conversation-counts">
                        {[
                          ["processes", "processes"],
                          ["rules", "rules"],
                          ["faqs", "FAQs"],
                          ["clarifications", "clarifications"],
                        ].map(([key, label]) =>
                          typeof job.summary?.[key] === "number" &&
                          Number(job.summary[key]) > 0 ? (
                            <span key={key}>
                              <strong>{Number(job.summary[key])}</strong>
                              {label}
                            </span>
                          ) : null,
                        )}
                      </div>
                      <p>
                        Source: {providerName} conversation ·{" "}
                        {job.approved ? "Already approved" : "Needs Review"}
                      </p>
                      <p>
                        {job.approved
                          ? "This conversation was already learned. Your approved knowledge is retained."
                          : "Opryn organized what it found. You decide what becomes official."}
                      </p>
                      <MotionButton
                        disabled={busy || !job.processId}
                        className="activation-primary"
                        onClick={() => {
                          if (job.processId) {
                            track(
                              intent.provider,
                              "learning_review_opened",
                              "learning_review_started",
                            );
                            onPrepared(job.processId);
                          }
                        }}
                      >
                        {job.approved ? "Try Opryn →" : "Review findings →"}
                      </MotionButton>
                    </>
                  ) : (
                    <>
                      <p>
                        {job?.status === "failed"
                          ? "Opryn couldn't organize this conversation. Send the request again to retry."
                          : expired
                            ? "This request expired. Prepare a new instruction to try again."
                            : intent.stage === "waiting"
                              ? `Ready when you are. Send the instruction in the ${providerName} conversation you want Opryn to learn from. We'll detect it here automatically.`
                              : `Open an existing ${providerName} conversation and send this prepared request. We'll check here automatically.`}
                      </p>
                      <blockquote>{request}</blockquote>
                      <div className="conversation-row-actions">
                        <MotionButton
                          disabled={busy}
                          className="activation-primary"
                          onClick={() =>
                            expired
                              ? void save({
                                  ...intent,
                                  stage: "name",
                                  requestId: undefined,
                                  expiresAt: undefined,
                                  since: undefined,
                                })
                              : void continueInProvider()
                          }
                        >
                          {expired
                            ? "Prepare a new instruction"
                            : `Open ${providerName} ↗`}
                        </MotionButton>
                        <MotionButton onClick={() => void copy()}>
                          {copied ? "Copied" : "Copy instruction"}
                        </MotionButton>
                        <MotionButton onClick={() => setSetup(intent.provider)}>
                          Need help
                        </MotionButton>
                      </div>
                      {intent.stage === "waiting" && !expired && (
                        <MotionButton
                          onClick={() => {
                            setNotice(
                              "We'll check automatically. Returning to this tab checks for your conversation; you don't need to refresh.",
                            );
                            setReceiptCheck((value) => value + 1);
                          }}
                        >
                          I sent it
                        </MotionButton>
                      )}
                      <p>
                        Paste or send the instruction in the existing
                        conversation you choose. Enable Opryn there if needed.
                        Opening the provider does not send anything.
                      </p>
                      <a
                        href={
                          intent.provider === "claude"
                            ? "https://claude.ai"
                            : "https://chatgpt.com"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open {providerName} ↗
                      </a>
                      <p className="activation-note">
                        If Opryn isn&apos;t available in your provider&apos;s
                        mobile app, finish this step on {providerName} web or
                        choose another source. Opryn cannot read your other
                        chats. Only send useful business information you want
                        stored in this workspace.
                      </p>
                    </>
                  )}
                </>
              )}
            </MotionRegion>
            {notice ? <p role="status">{notice}</p> : null}
            <button
              disabled={busy}
              className="activation-back"
              onClick={() => {
                void save(null);
                setJob(null);
                setCandidate(null);
                setConfirmedJobId(null);
                setExpired(false);
              }}
            >
              Choose another source
            </button>
          </div>
        </DialogSurface>
      ) : null}
      {!intent && notice ? (
        <p role="status">
          {notice}
          <button onClick={() => location.reload()}>Try again</button>
        </p>
      ) : null}
    </section>
  );
}
