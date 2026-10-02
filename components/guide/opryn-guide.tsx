"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Check, Compass, X } from "lucide-react";
import { DialogSurface } from "@/components/app/dialog-surface";
import {
  OprynThinkingOrb,
  type OprynThinkingState,
} from "@/components/motion/opryn-thinking-orb";
import { hasUnsavedChanges } from "@/components/app/settings/form-state";
import {
  guideTargets,
  guides,
  pageTargets,
  milestoneLabels,
  canGuideTarget,
  resolveGuideDestination,
  type GuideId,
  type GuideRole,
  type GuideStep,
  type SetupFacts,
  type TargetId,
  type Milestone,
} from "@/lib/guide/registry";
import { resumeSchema, type GuideReply } from "@/lib/guide/schema";
import { MotionRegion } from "@/components/motion/motion-region";
import { PresenceSwap } from "@/components/motion/presence-swap";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";
import { showSpotlight } from "./spotlight";
import { GuideCompanion } from "./guide-companion";
import "driver.js/dist/driver.css";
import "./guide.css";

type State = {
  userId: string;
  organizationId: string;
  role: GuideRole;
  facts: SetupFacts;
  integrations: Array<{
    provider: string;
    name: string;
    status: string;
    capabilities: string[];
    label: string | null;
  }>;
};
type Active = { title: string; steps: GuideStep[]; index: number };
const coreMilestones: Milestone[] = ["source", "approved", "answered"];

export function OprynGuide({
  organizationId,
  workspace,
}: {
  organizationId: string;
  workspace: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [paused, setPaused] = useState(false);
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState<{
    state: OprynThinkingState;
    label: string;
  } | null>(null);
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [reply, setReply] = useState<GuideReply | null>(null);
  const [notice, setNotice] = useState("");
  const [statusError, setStatusError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const mounted = useRef(true);
  const requests = useRef(new Set<AbortController>());
  const requestBusy = useRef(false);
  const actionEpoch = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const explicitTour = useRef(
    new URLSearchParams(search).get("tour") === "opryn",
  );
  const persistKey = state
    ? `opryn:guide:v1:${state.userId}:${organizationId}`
    : null;

  const api = useCallback(
    async (body?: object) => {
      const abort = new AbortController();
      requests.current.add(abort);
      const timeout = setTimeout(() => abort.abort(), 24000);
      try {
        const response = await fetch("/api/guide", {
          method: body ? "POST" : "GET",
          cache: "no-store",
          signal: abort.signal,
          headers: {
            "Content-Type": "application/json",
            "x-opryn-organization": organizationId,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const result = await response.json();
        if (!mounted.current) throw new Error("Guide closed.");
        if (!response.ok) {
          if ([401, 403, 409].includes(response.status)) {
            setActive(null);
            setState(null);
          }
          throw new Error(result.error || "Guide could not load. Try again.");
        }
        return result;
      } finally {
        clearTimeout(timeout);
        requests.current.delete(abort);
      }
    },
    [organizationId],
  );

  const refresh = useCallback(async (): Promise<State | null> => {
    try {
      const result = await api();
      if (result.organizationId !== organizationId)
        throw new Error("Workspace changed. Reload to continue.");
      setState(result);
      setStatusError("");
      return result;
    } catch (error) {
      if (mounted.current)
        setStatusError(
          error instanceof Error
            ? error.message
            : "Setup status is unavailable.",
        );
      return null;
    }
  }, [api, organizationId, setState, setStatusError]);
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void refresh(), 0);
    const controllers = requests.current;
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      controllers.forEach((controller) => controller.abort());
    };
  }, [refresh]);
  useEffect(() => {
    if (!open && !active) return;
    const update = () => {
      if (!document.hidden && !requestBusy.current) void refresh();
    };
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    const interval = setInterval(update, 30000);
    return () => {
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      clearInterval(interval);
    };
  }, [open, active, refresh]);

  useEffect(() => {
    if (!state || !persistKey || restored.current) return;
    // Hydrate device-local guide state after the authenticated context arrives.
    const frame = requestAnimationFrame(() => {
      restored.current = true;
      try {
        // An explicit new tour must not be replaced by an old saved guide.
        if (explicitTour.current) {
          sessionStorage.removeItem(persistKey);
          return;
        }
        setDismissed(localStorage.getItem(`${persistKey}:dismissed`) === "1");
        const parsed = resumeSchema.safeParse(
          JSON.parse(sessionStorage.getItem(persistKey) || "null"),
        );
        if (
          !parsed.success ||
          parsed.data.userId !== state.userId ||
          parsed.data.organizationId !== organizationId ||
          Date.now() - parsed.data.savedAt > 86400000 ||
          parsed.data.index >= parsed.data.steps.length ||
          parsed.data.steps.some(
            (step) => !canGuideTarget(step.targetId, state.role),
          )
        ) {
          sessionStorage.removeItem(persistKey);
          return;
        }
        setActive({
          title: parsed.data.title,
          steps: parsed.data.steps,
          index: parsed.data.index,
        });
        // OAuth/Picker owns the return. Never put a tour on top of provider UI.
        setPaused(true);
        setNotice(
          parsed.data.steps[parsed.data.index].targetId === "teach.google" &&
            state.facts.google === true
            ? "Google is connected. Choose the files Opryn should learn from, then continue your guide."
            : "Your guide is saved. Continue when you're back from the current step.",
        );
      } catch {
        /* Storage-disabled browsers still support in-session guidance. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [state, persistKey, organizationId]);
  useEffect(() => {
    if (!persistKey || !state || !restored.current) return;
    try {
      if (!active) sessionStorage.removeItem(persistKey);
      else
        sessionStorage.setItem(
          persistKey,
          JSON.stringify({
            version: 1,
            userId: state.userId,
            organizationId,
            ...active,
            savedAt: Date.now(),
          }),
        );
    } catch {
      /* Never block a workflow on browser storage. */
    }
  }, [active, persistKey, state, organizationId]);

  const exit = useCallback(() => {
    actionEpoch.current++;
    requestBusy.current = false;
    setBusy(false);
    setActive(null);
    setMissing(false);
    setPaused(false);
    setNotice("Guide closed. Your work is unchanged.");
  }, [setBusy, setActive, setMissing, setPaused, setNotice]);
  const advance = useCallback(async () => {
    if (!active || requestBusy.current) return;
    const epoch = ++actionEpoch.current;
    requestBusy.current = true;
    setBusy(true);
    setPaused(true);
    try {
      const fresh = await refresh();
      if (!fresh || epoch !== actionEpoch.current) return;
      const current = active.steps[active.index];
      if (current.milestone && fresh.facts[current.milestone] !== true) {
        setNotice(
          fresh.facts[current.milestone] === null
            ? "I couldn't verify this step yet. Retry when the page has finished saving."
            : `Complete “${milestoneLabels[current.milestone]}” in the product, then continue. Nothing is submitted by Guide.`,
        );
        return;
      }
      if (active.index + 1 >= active.steps.length) {
        setActive(null);
        setNotice(
          "Guide finished. Product changes are saved only by the actions you confirm.",
        );
      } else {
        setActive({ ...active, index: active.index + 1 });
        setPaused(false);
        setMissing(false);
        setNotice("");
      }
    } finally {
      if (epoch === actionEpoch.current) {
        requestBusy.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }, [active, refresh]);
  const back = useCallback(() => {
    setActive((current) =>
      current ? { ...current, index: Math.max(0, current.index - 1) } : null,
    );
    setPaused(false);
    setMissing(false);
    setNotice("");
  }, [setActive, setPaused, setMissing, setNotice]);

  const role = state?.role;
  useEffect(() => {
    if (!active || !role || open || paused || missing) return;
    const step = active.steps[active.index];
    if (!canGuideTarget(step.targetId, role)) return;
    const target = guideTargets[step.targetId];
    const url = new URL(target.route, location.origin);
    // Authorization is checked again on EVERY step, including restored guides.
    let cleanup = () => {};
    let cancelled = false;
    void api({ action: "show", targetId: step.targetId })
      .then(() => {
        if (cancelled) return;
        if (
          pathname !== url.pathname ||
          (url.search && url.search.slice(1) !== search)
        ) {
          if (
            hasUnsavedChanges() &&
            !window.confirm("Leave without saving your changes?")
          ) {
            setPaused(true);
            return;
          }
          router.push(target.route, { scroll: false });
          return;
        }
        cleanup = showSpotlight({
          targetId: step.targetId,
          index: active.index,
          total: active.steps.length,
          lastPoint,
          pointer: active.steps.length === 1,
          onNext: () => void advance(),
          onBack: back,
          onExit: exit,
          onInteract: () => {
            setPaused(true);
            setNotice(
              "Complete this step in Opryn. Your guide will be here when you're ready.",
            );
          },
          onMissing: () => {
            setMissing(true);
            setNotice(
              "I couldn't open that control. Try again or continue manually.",
            );
          },
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setMissing(true);
          setNotice(error.message || "Guide couldn't open this control.");
        }
      });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    active,
    role,
    pathname,
    search,
    open,
    paused,
    missing,
    retry,
    api,
    router,
    advance,
    back,
    exit,
  ]); // facts changes must not restart a spotlight

  const start = useCallback(
    async (
      action:
        | { action: "start"; guideId: GuideId }
        | { action: "show"; targetId: TargetId },
    ) => {
      if (requestBusy.current) return;
      const epoch = ++actionEpoch.current;
      requestBusy.current = true;
      setBusy(true);
      setNotice("");
      try {
        const result = await api(action);
        if (epoch !== actionEpoch.current) return;
        if (!result.steps?.length)
          throw new Error("No available steps in this guide.");
        setState({
          userId: result.userId,
          organizationId: result.organizationId,
          role: result.role,
          facts: result.facts,
          integrations: result.integrations ?? [],
        });
        setActive({ title: result.title, steps: result.steps, index: 0 });
        setPaused(false);
        setMissing(false);
        setOpen(false);
      } catch (error) {
        if (mounted.current && epoch === actionEpoch.current)
          setNotice(
            error instanceof Error ? error.message : "Guide couldn't start.",
          );
      } finally {
        if (epoch === actionEpoch.current) {
          requestBusy.current = false;
          if (mounted.current) setBusy(false);
        }
      }
    },
    [
      api,
      setBusy,
      setNotice,
      setState,
      setActive,
      setPaused,
      setMissing,
      setOpen,
    ],
  );
  const tourRequested = useRef(false);
  useEffect(() => {
    if (
      !state ||
      tourRequested.current ||
      new URLSearchParams(search).get("tour") !== "opryn"
    )
      return;
    tourRequested.current = true;
    const params = new URLSearchParams(search);
    params.delete("tour");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
    // Explicit completion-screen choice only. The server authorizes each step.
    void start({ action: "start", guideId: "product-tour" });
  }, [state, search, pathname, router, start]);
  async function ask(prompt = question) {
    const nextQuestion = prompt.trim();
    if (!nextQuestion || requestBusy.current) return;
    const destination = state
      ? resolveGuideDestination(nextQuestion, state.role)
      : null;
    if (destination) {
      if (
        hasUnsavedChanges() &&
        !window.confirm("Leave without saving your changes?")
      )
        return;
      setQuestion("");
      setReply(null);
      setNotice("");
      setOpen(false);
      router.push(destination.route);
      return;
    }
    const epoch = ++actionEpoch.current;
    requestBusy.current = true;
    setBusy(true);
    const checksConnections =
      /connect|integration|notion|confluence|google|slack|teams/i.test(
        nextQuestion,
      );
    setThinking({
      state: checksConnections ? "searching" : "solving",
      label: checksConnections
        ? "Checking your connections…"
        : "Checking Opryn…",
    });
    setLastQuestion(nextQuestion);
    setReply(null);
    setNotice("");
    try {
      const result = await api({
        action: "ask",
        question: nextQuestion,
        path: pathname,
      });
      if (epoch !== actionEpoch.current) return;
      setReply(result);
      setQuestion("");
      setNotice(result.notice || "");
    } catch (error) {
      if (mounted.current && epoch === actionEpoch.current)
        setNotice(
          error instanceof Error
            ? error.message
            : "Guide could not answer. Try again.",
        );
    } finally {
      if (epoch === actionEpoch.current) {
        requestBusy.current = false;
        if (mounted.current) setBusy(false);
        if (mounted.current) setThinking(null);
      }
    }
  }
  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation || (!lastQuestion && !reply)) return;
    const messages = conversation.querySelectorAll<HTMLElement>(
      "[data-guide-message]",
    );
    const message = messages.item(messages.length - 1);
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      message.scrollIntoView({
        block: "nearest",
        behavior: prefersReducedMotion(conversation) ? "auto" : "smooth",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [lastQuestion, reply]);
  const targets = state ? pageTargets(pathname, state.role) : [];
  const quickPrompts = contextualPrompts(pathname);
  const milestones =
    state?.role === "employee" ? ["answered" as Milestone] : coreMilestones;
  const completed = milestones.filter((id) => state?.facts[id] === true).length;
  const setupIncomplete = state && completed < milestones.length;
  function minimize() {
    setDismissed(true);
    try {
      if (persistKey) localStorage.setItem(`${persistKey}:dismissed`, "1");
    } catch {}
  }
  function continueHere() {
    setPaused(false);
    setMissing(false);
    setRetry((value) => value + 1);
    setNotice("");
  }
  function closePanel() {
    actionEpoch.current++;
    requestBusy.current = false;
    setBusy(false);
    setThinking(null);
    setOpen(false);
  }

  return (
    <>
      {pathname === "/app" && setupIncomplete && !dismissed ? (
        <section className="guide-setup-strip" aria-label="Set up Opryn">
          <div>
            <p className="guide-eyebrow">YOUR FIRST VALUE MOMENT</p>
            <strong>Finish setting up Opryn</strong>
            <p>
              {completed} of {milestones.length} verified ·{" "}
              {
                milestoneLabels[
                  milestones.find((id) => state.facts[id] !== true)!
                ]
              }
            </p>
          </div>
          <progress
            value={completed}
            max={milestones.length}
            aria-label="Verified setup progress"
          />
          <button
            onClick={() => {
              router.push(
                state.role === "employee" ? "/app/ask" : "/onboarding",
              );
            }}
          >
            Continue setup <ArrowRight size={15} />
          </button>
          <button aria-label="Minimize setup reminder" onClick={minimize}>
            <X size={16} />
          </button>
        </section>
      ) : null}
      <div className={`guide-dock ${active ? "guide-dock-active" : ""}`}>
        {active && (paused || missing) ? (
          <div className="guide-resume" role="status">
            <p>
              <strong>{active.title}</strong>
              <span>
                Step {active.index + 1} of {active.steps.length}
              </span>
            </p>
            <p>{notice || "Your progress is saved on this device."}</p>
            <div>
              <button onClick={continueHere} disabled={busy}>
                {missing ? "Retry target" : "Show this step"}
              </button>
              <button onClick={() => void advance()} disabled={busy}>
                {busy ? "Checking…" : "Continue"}
              </button>
              <button onClick={exit}>Exit</button>
            </div>
            {missing ? (
              <button
                onClick={() => {
                  if (active.index + 1 < active.steps.length) {
                    setActive({ ...active, index: active.index + 1 });
                    setMissing(false);
                    setPaused(false);
                  } else exit();
                }}
              >
                Skip guidance — not completion
              </button>
            ) : null}
          </div>
        ) : null}
        {(!active || paused || missing) && (
          <button
            className="guide-launcher"
            onClick={() => {
              setOpen(true);
              setPaused(true);
              void refresh();
            }}
            aria-haspopup="dialog"
          >
            <Compass size={17} aria-hidden /> Ask Opryn
          </button>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {active
          ? `Step ${active.index + 1} of ${active.steps.length}. ${guideTargets[active.steps[active.index].targetId].title}. `
          : ""}
        {notice}
      </p>
      {open ? (
        <DialogSurface
          label="Ask Opryn"
          onClose={closePanel}
          className="dialog-guide"
        >
          <section className="dialog-content guide-panel">
            <header>
              <div>
                <GuideCompanion thinking={busy} />
                <h2>Ask Opryn</h2>
                <small>Ask about Opryn or your setup.</small>
              </div>
              <button aria-label="Close Ask Opryn" onClick={closePanel}>
                <X size={20} />
              </button>
            </header>
            <div className="guide-panel-scroll">
              <div className="guide-conversation" ref={conversationRef}>
                <section
                  className="guide-message guide-message--assistant"
                  data-guide-message
                >
                  <GuideCompanion />
                  <div>
                    <p>
                      Hi — I can answer questions about Opryn or take you where
                      you need to go.
                    </p>
                    <small>
                      Working in <strong>{workspace}</strong>
                    </small>
                  </div>
                </section>

                {lastQuestion ? (
                  <MotionRegion variant="status" changeKey={lastQuestion}>
                    <section
                      className="guide-message guide-message--user"
                      data-guide-message
                    >
                      <p>{lastQuestion}</p>
                    </section>
                  </MotionRegion>
                ) : null}

                {reply ? (
                  <MotionRegion variant="status" changeKey={reply.message}>
                    <section
                      className="guide-message guide-message--assistant guide-answer"
                      data-guide-message
                      aria-live="polite"
                    >
                      <span className="guide-message-mark" aria-hidden>
                        <Image
                          src="/favicon-32x32.png"
                          alt=""
                          width={17}
                          height={17}
                        />
                      </span>
                      <div>
                        <p>{reply.message}</p>
                        <div className="guide-answer-actions">
                          {reply.suggestedTargets?.map((id) =>
                            state && canGuideTarget(id, state.role) ? (
                              <button
                                key={id}
                                disabled={busy}
                                onClick={() =>
                                  void start({ action: "show", targetId: id })
                                }
                              >
                                Show me: {guideTargets[id].title} →
                              </button>
                            ) : null,
                          )}
                          {reply.guideId ? (
                            <button
                              disabled={busy}
                              onClick={() =>
                                void start({
                                  action: "start",
                                  guideId: reply.guideId!,
                                })
                              }
                            >
                              Do it with me →
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  </MotionRegion>
                ) : null}

                {statusError ? (
                  <section
                    className="guide-message guide-message--system"
                    data-guide-message
                    role="alert"
                  >
                    <p>{statusError}</p>
                    <button onClick={() => void refresh()}>
                      Retry setup status
                    </button>
                  </section>
                ) : null}
                {!state && !statusError ? (
                  <p className="guide-loading" role="status">
                    Loading your workspace…
                  </p>
                ) : null}
                {notice ? (
                  <p className="guide-notice" role="status" data-guide-message>
                    {notice}
                  </p>
                ) : null}
              </div>

              {!lastQuestion && !reply ? (
                <div
                  className="guide-quick-prompts"
                  aria-label="Suggested questions"
                >
                  {quickPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      disabled={busy || !state}
                      onClick={() => void ask(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              ) : null}

              <details className="guide-more">
                <summary>More ways I can help</summary>
                <div className="guide-more__content">
                  {setupIncomplete ? (
                    <section className="guide-setup-list">
                      <h3>
                        Setup progress
                        <span>
                          {completed}/{milestones.length}
                        </span>
                      </h3>
                      {milestones.map((id) => (
                        <p key={id}>
                          <span aria-hidden>
                            {state.facts[id] === true ? (
                              <Check size={15} />
                            ) : (
                              "○"
                            )}
                          </span>
                          {milestoneLabels[id]}
                        </p>
                      ))}
                      <button
                        className="guide-primary"
                        disabled={busy}
                        onClick={() =>
                          void start({
                            action: "start",
                            guideId: "setup-opryn",
                          })
                        }
                      >
                        Do setup with me <ArrowRight size={15} />
                      </button>
                    </section>
                  ) : null}

                  {targets.length ? (
                    <section className="guide-actions">
                      <h3>On this page</h3>
                      {targets.slice(0, 4).map((id) => (
                        <button
                          key={id}
                          disabled={busy}
                          onClick={() =>
                            void start({ action: "show", targetId: id })
                          }
                        >
                          <span>{guideTargets[id].title}</span>
                          <small>Show me →</small>
                        </button>
                      ))}
                    </section>
                  ) : null}

                  <details className="guide-workflows">
                    <summary>Guided workflows</summary>
                    {Object.entries(guides)
                      .filter(([, guide]) =>
                        guide.steps.some(
                          (step) =>
                            state && canGuideTarget(step.targetId, state.role),
                        ),
                      )
                      .map(([id, guide]) => (
                        <button
                          key={id}
                          disabled={busy}
                          onClick={() =>
                            void start({
                              action: "start",
                              guideId: id as GuideId,
                            })
                          }
                        >
                          {guide.title}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                  </details>

                  {active ? (
                    <div className="guide-current">
                      <p>In progress: {active.title}</p>
                      <button
                        onClick={() => {
                          setOpen(false);
                          continueHere();
                        }}
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => {
                          setActive({ ...active, index: 0 });
                          setOpen(false);
                          continueHere();
                        }}
                      >
                        Restart
                      </button>
                      <button onClick={exit}>Exit</button>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
            <form
              className="guide-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void ask();
              }}
            >
              <label className="sr-only" htmlFor="guide-question">
                Ask about using Opryn
              </label>
              <div>
                <input
                  id="guide-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={1200}
                  placeholder="Ask Opryn…"
                  autoComplete="off"
                />
                <button
                  className={`guide-submit ${thinking ? "guide-submit--thinking" : ""}`}
                  disabled={busy || !question.trim() || !state}
                  type="submit"
                  aria-label={thinking ? thinking.label : "Ask Opryn"}
                >
                  <PresenceSwap value={thinking ? "thinking" : "ask"}>
                    {thinking ? (
                      <OprynThinkingOrb
                        state={thinking.state}
                        size={20}
                        label={thinking.label}
                        decorative
                      />
                    ) : (
                      <>
                        Ask <ArrowRight aria-hidden size={15} />
                      </>
                    )}
                  </PresenceSwap>
                </button>
              </div>
              <small>
                Try “Take me to Knowledge.” Don&apos;t include secrets.
              </small>
            </form>
          </section>
        </DialogSurface>
      ) : null}
    </>
  );
}

function contextualPrompts(pathname: string) {
  if (pathname === "/app/processes/new")
    return [
      "What should I teach first?",
      "Show my connected sources",
      "Help me use Notion",
      "How does review work?",
    ];
  if (pathname === "/app/processes")
    return [
      "How do I organize this?",
      "Show items needing review",
      "How do I archive a process?",
      "What does Approved mean?",
    ];
  if (pathname.startsWith("/app/integrations"))
    return [
      "Which sources are connected?",
      "What does Confluence do?",
      "Help me reconnect Teams",
    ];
  return [
    "What can I do here?",
    "Show my connected sources",
    "Where are settings?",
    "How do approvals work?",
  ];
}
