"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Compass, X } from "lucide-react";
import { DialogSurface } from "@/components/app/dialog-surface";
import { hasUnsavedChanges } from "@/components/app/settings/form-state";
import {
  guideTargets,
  guides,
  pageTargets,
  milestoneLabels,
  canGuideTarget,
  type GuideId,
  type GuideRole,
  type GuideStep,
  type SetupFacts,
  type TargetId,
  type Milestone,
} from "@/lib/guide/registry";
import { resumeSchema, type GuideReply } from "@/lib/guide/schema";
import { showSpotlight } from "./spotlight";
import "driver.js/dist/driver.css";
import "./guide.css";

type State = {
  userId: string;
  organizationId: string;
  role: GuideRole;
  facts: SetupFacts;
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
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<GuideReply | null>(null);
  const [notice, setNotice] = useState("");
  const [statusError, setStatusError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const mounted = useRef(true);
  const requests = useRef(new Set<AbortController>());
  const requestBusy = useRef(false);
  const actionEpoch = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const restored = useRef(false);
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
  }, [api, organizationId]);
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
  }, []);
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
  }, []);

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

  async function start(
    action:
      | { action: "start"; guideId: GuideId }
      | { action: "show"; targetId: TargetId },
  ) {
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
  }
  async function ask() {
    if (!question.trim() || requestBusy.current) return;
    const epoch = ++actionEpoch.current;
    requestBusy.current = true;
    setBusy(true);
    setNotice("");
    try {
      const result = await api({ action: "ask", question, path: pathname });
      if (epoch !== actionEpoch.current) return;
      setReply(result);
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
      }
    }
  }
  const targets = state ? pageTargets(pathname, state.role) : [];
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
              router.push(state.role === "employee" ? "/app/ask" : "/onboarding");
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
            <Compass size={17} aria-hidden /> Opryn Guide
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
          label="Opryn Guide"
          onClose={closePanel}
          className="dialog-guide"
        >
          <section className="dialog-content guide-panel">
            <header>
              <div>
                <p className="guide-eyebrow">PRODUCT GUIDANCE</p>
                <h2>Opryn Guide</h2>
              </div>
              <button aria-label="Close Opryn Guide" onClick={closePanel}>
                <X size={20} />
              </button>
            </header>
            <div className="guide-panel-scroll">
              <p className="guide-workspace">
                Working in <strong>{workspace}</strong>
              </p>
              <p className="guide-intro">
                Ask how Opryn works.
                <br />
                <strong>I can show you where to go.</strong>
              </p>
              {statusError ? (
                <div role="alert">
                  <p>{statusError}</p>
                  <button onClick={() => void refresh()}>
                    Retry setup status
                  </button>
                </div>
              ) : null}
              {!state && !statusError ? (
                <p role="status">Loading your available guides…</p>
              ) : null}
              {setupIncomplete ? (
                <section className="guide-setup-list">
                  <h3>
                    Set up Opryn{" "}
                    <span>
                      {completed}/{milestones.length}
                    </span>
                  </h3>
                  {milestones.map((id) => (
                    <p key={id}>
                      <span aria-hidden>
                        {state.facts[id] === true ? <Check size={15} /> : "○"}
                      </span>
                      {milestoneLabels[id]}
                      <small>
                        {state.facts[id] === null
                          ? "Not verified"
                          : state.facts[id] === true
                            ? "Complete"
                            : ""}
                      </small>
                    </p>
                  ))}
                  <button
                    className="guide-primary"
                    disabled={busy}
                    onClick={() =>
                      void start({ action: "start", guideId: "setup-opryn" })
                    }
                  >
                    Let&apos;s do it together <ArrowRight size={15} />
                  </button>
                </section>
              ) : null}
              <section className="guide-actions">
                <h3>What can I do here?</h3>
                {targets.slice(0, 5).map((id) => (
                  <button
                    key={id}
                    disabled={busy}
                    onClick={() => void start({ action: "show", targetId: id })}
                  >
                    <span>{guideTargets[id].title}</span>
                    <small>Show me →</small>
                  </button>
                ))}
              </section>
              {reply ? (
                <section className="guide-answer" aria-live="polite">
                  <p>{reply.message}</p>
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
                  {reply.guideId && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void start({ action: "start", guideId: reply.guideId! })
                      }
                    >
                      Do it with me →
                    </button>
                  )}
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
                        void start({ action: "start", guideId: id as GuideId })
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
                    Resume guide
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
                  <button onClick={exit}>Exit guide</button>
                </div>
              ) : null}
              <p role="status" className="guide-notice">
                {notice}
              </p>
            </div>
            <form
              className="guide-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void ask();
              }}
            >
              <label htmlFor="guide-question">Ask about using Opryn</label>
              <div>
                <input
                  id="guide-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  maxLength={1200}
                  placeholder="Where do I connect Google?"
                  autoComplete="off"
                />
                <button
                  className="guide-primary"
                  disabled={busy || !question.trim() || !state}
                  type="submit"
                >
                  {busy ? "Working…" : "Ask"}
                </button>
              </div>
              <small>
                Product help only. Don&apos;t include secrets or company
                documents.
              </small>
            </form>
          </section>
        </DialogSurface>
      ) : null}
    </>
  );
}
