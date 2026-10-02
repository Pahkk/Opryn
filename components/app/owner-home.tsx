"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  MessageSquare,
  RefreshCw,
  Users,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useIsPresent,
} from "motion/react";
import type { NeedsYouItem } from "@/lib/opryn/needs-you";
import { AskIcon, KnowledgeIcon } from "@/components/opryn-icons/opryn-icons";
import {
  OprynAction,
  useActionFeedback,
} from "@/components/motion/opryn-action";
import { SuccessCheck } from "@/components/motion/success-check";
import { MotionNumber } from "@/components/motion/motion-number";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";
import { LocalGreeting } from "./local-greeting";
import { OwnerAnswer } from "./owner-answer";
import "./owner-home.css";

type Props = {
  name: string;
  organizationName: string;
  handledCount: number;
  hasApprovedKnowledge?: boolean;
  gapCount: number;
  items: NeedsYouItem[];
  initialQuestionId?: string;
  teach: { title: string; reason: string; href: string; action: string } | null;
  handled: {
    id: string;
    question: string;
    created_at: string;
    origin?: string;
  }[];
  recentKnowledge: { id: string; title: string; status: string }[];
  health: ReactNode;
  intelligence: ReactNode;
  learning?: ReactNode;
  setupHref?: string;
};

export function OwnerHome(p: Props) {
  const router = useRouter();
  const reduced = useProductReducedMotion();
  const group = useId();
  const [settled, setSettled] = useState<
    Record<string, { title: string; approved: boolean }>
  >({});
  const [receipts, setReceipts] = useState<
    { id: string; title: string; href: string }[]
  >([]);
  const [milestone, setMilestone] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(
    () =>
      p.items.find(
        (i) => i.type === "question" && i.targetId === p.initialQuestionId,
      )?.id ?? null,
  );
  const refreshButton = useRef<HTMLButtonElement>(null);
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 90_000);
    return () => window.clearInterval(interval);
  }, [router]);
  const visibleItems = p.items.filter((i) => !settled[i.id]);
  const teachRepeatsDecision = p.teach
    ? visibleItems.some(
        (item) =>
          item.title.trim().toLowerCase() ===
          p.teach?.title.trim().toLowerCase(),
      )
    : false;
  function resolved(item: NeedsYouItem, title: string, approved: boolean) {
    setSettled((current) => ({ ...current, [item.id]: { title, approved } }));
    setExpanded(null);
    if (
      document.activeElement
        ?.closest("[data-decision-id]")
        ?.getAttribute("data-decision-id") === item.id
    )
      refreshButton.current?.focus({ preventScroll: true });
    if (approved && p.hasApprovedKnowledge === false && !milestone)
      setMilestone(title);
    if (approved)
      setReceipts((current) =>
        [
          { id: item.id, title, href: "/app/processes?view=recent" },
          ...current,
        ].slice(0, 3),
      );
    router.refresh();
  }
  const entrance = (index: number) => ({
    initial: false as const,
    animate: reduced
      ? { opacity: 1, y: 0 }
      : { opacity: [0.65, 1], y: [10, 0] },
    transition: {
      ...uiTransition(reduced, motionTokens.duration.emphasis),
      delay: reduced ? 0 : index * 0.065,
    },
  });
  return (
    <LayoutGroup id={group}>
      <div className="owner-home" data-motion-owner="motion">
        <motion.header {...entrance(0)} className="owner-header">
          <div className="owner-header-top">
            <div>
              <p className="owner-eyebrow">
                {p.organizationName} <span aria-hidden="true">/</span> Overview
              </p>
              <LocalGreeting name={p.name} />
              <p className="owner-intro">
                Your decisions, team activity, and company knowledge in one
                place.
              </p>
            </div>
            <button
              className="owner-refresh"
              ref={refreshButton}
              type="button"
              disabled={refreshing}
              aria-label="Refresh dashboard"
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCw size={15} aria-hidden="true" />
              {refreshing ? "Updating…" : "Refresh"}
            </button>
          </div>
          <nav className="owner-action-rail" aria-label="Home quick actions">
            {[
              ["Ask Opryn", "/app/ask", MessageSquare],
              ["Teach Opryn", "/app/processes/new", BookOpen],
              ["Review", "/app/needs-you", CheckCheck],
              ["Invite", "/app/team", Users],
            ].map(([label, href, Icon]) => {
              const Glyph = Icon as typeof MessageSquare;
              return (
                <Link key={label as string} href={href as string}>
                  <Glyph size={16} aria-hidden="true" />
                  {label as string}
                </Link>
              );
            })}
          </nav>
          <div className="owner-summary" aria-label="Workspace summary">
            <span>
              <span className="owner-stat-label">Handled this week</span>
              <strong>
                <MotionNumber value={p.handledCount} />
              </strong>
              <span className="owner-stat-note">
                Answered from approved knowledge
              </span>
            </span>
            <Link href="/app/needs-you">
              <span className="owner-stat-label">Need you</span>
              <strong>
                <MotionNumber value={visibleItems.length} />
              </strong>
              <span className="owner-stat-note">
                Questions and decisions to review{" "}
                <ArrowRight size={13} aria-hidden="true" />
              </span>
            </Link>
            <Link href="/app/knowledge-gaps">
              <span className="owner-stat-label">
                {p.gapCount === 1 ? "Knowledge gap" : "Knowledge gaps"}
              </span>
              <strong>
                <MotionNumber value={p.gapCount} />
              </strong>
              <span className="owner-stat-note">
                Answers your team is missing{" "}
                <ArrowRight size={13} aria-hidden="true" />
              </span>
            </Link>
          </div>
          {p.setupHref ? (
            <Link className="owner-resume" href={p.setupHref}>
              Your setup is saved. Continue when you’re ready →
            </Link>
          ) : null}
        </motion.header>
        {p.learning}
        {milestone ? (
          <div className="owner-first-approval" role="status">
            <SuccessCheck variant="normal" />
            <div>
              <strong>Your first knowledge is live.</strong>
              <p>Opryn can now use {milestone} to answer questions.</p>
            </div>
            {!reduced ? (
              <span className="owner-small-confetti" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <motion.i
                    key={index}
                    style={{
                      background: ["#2855f9", "#b8d9ff", "#ffd5b5"][index % 3],
                    }}
                    initial={{ opacity: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      x: (index - 2.5) * 14,
                      y: [0, -28, 12],
                    }}
                    transition={{ duration: 0.65 }}
                  />
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="owner-workspace">
          <motion.section
            {...entrance(1)}
            className="owner-decisions"
            aria-labelledby="home-decisions-title"
          >
            <div className="owner-section-heading">
              <div>
                <h2 id="home-decisions-title">
                  Needs you
                  <span className="owner-count">{visibleItems.length}</span>
                </h2>
                <p className="owner-section-description">
                  A few decisions to keep your team moving.
                </p>
              </div>
              <Link href="/app/needs-you">View all →</Link>
            </div>
            <div className="owner-decision-list">
              <AnimatePresence initial={false}>
                {visibleItems.slice(0, 5).map((item) => (
                  <DecisionRow
                    key={item.id}
                    item={item}
                    expanded={expanded === item.id}
                    onToggle={() =>
                      setExpanded((current) =>
                        current === item.id ? null : item.id,
                      )
                    }
                    onResolved={(title, approved) =>
                      resolved(item, title, approved)
                    }
                  />
                ))}
              </AnimatePresence>
              {!visibleItems.length ? (
                <div className="owner-empty">
                  <SuccessCheck variant="normal" />
                  <h3>You’re caught up.</h3>
                  <p>Opryn doesn’t need a decision from you right now.</p>
                  <Link href="/app/ask">Try your approved guidance →</Link>
                </div>
              ) : null}
            </div>
          </motion.section>
          <motion.aside
            {...entrance(2)}
            className="owner-teach"
            aria-labelledby="home-teach-title"
          >
            <div className="owner-teach-heading">
              <span className="owner-teach-icon">
                <BookOpen size={19} aria-hidden="true" />
              </span>
              <h2 id="home-teach-title">Teach next</h2>
            </div>
            {p.teach ? (
              <>
                <h3>
                  {teachRepeatsDecision
                    ? "Turn this question into lasting guidance."
                    : p.teach.title}
                </h3>
                <p>{p.teach.reason}</p>
                <Link className="owner-primary-link" href={p.teach.href}>
                  {p.teach.action}
                  <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <>
                <h3>Keep your guidance useful.</h3>
                <p>No teaching recommendation is available right now.</p>
                <Link className="owner-primary-link" href="/app/processes/new">
                  Teach something new <span aria-hidden="true">→</span>
                </Link>
              </>
            )}
            <p className="owner-teach-note">
              One process, policy, or answer is enough.
            </p>
          </motion.aside>
          <motion.section
            {...entrance(3)}
            className="owner-handled"
            aria-labelledby="home-handled-title"
          >
            <div className="owner-section-heading">
              <div>
                <h2 id="home-handled-title">Recently handled</h2>
                <p className="owner-section-description">
                  The latest questions Opryn answered for your team.
                </p>
              </div>
              <Link href="/app/knowledge/week">This week →</Link>
            </div>
            {p.handled.length ? (
              p.handled.map((item) => (
                <details className="owner-activity" key={item.id}>
                  <summary>
                    <CheckCheck size={19} aria-hidden="true" />
                    <span>
                      <strong>{item.question}</strong>
                      <small>
                        {channelName(item.origin)} · Answered from approved
                        knowledge
                      </small>
                    </span>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </time>
                    <span aria-hidden="true">+</span>
                  </summary>
                  <div>
                    <p>{item.question}</p>
                    <Link
                      href={`/app/ask?question=${encodeURIComponent(item.question)}`}
                    >
                      Ask a follow-up and view its sources →
                    </Link>
                  </div>
                </details>
              ))
            ) : (
              <div className="owner-empty owner-empty-small">
                <AskIcon size={22} />
                <h3>Your first answer starts here.</h3>
                <p>
                  Ask Opryn or connect your team to start seeing activity here.
                </p>
                <Link href="/app/ask">Ask a company question →</Link>
              </div>
            )}
            {receipts.length || p.recentKnowledge.length ? (
              <div className="owner-recent-knowledge">
                <p className="owner-eyebrow">Recently approved</p>
                <AnimatePresence initial={false}>
                  {receipts.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={uiTransition(reduced)}
                    >
                      <Link href={item.href}>
                        <KnowledgeIcon size={16} />
                        {item.title}
                        <span>Approved just now →</span>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {p.recentKnowledge
                  .filter(
                    (i) =>
                      i.status === "approved" &&
                      !receipts.some((r) => r.title === i.title),
                  )
                  .slice(0, 3)
                  .map((item) => (
                    <Link key={item.id} href={`/app/processes/${item.id}`}>
                      <KnowledgeIcon size={16} />
                      {item.title}
                      <span>Approved →</span>
                    </Link>
                  ))}
              </div>
            ) : null}
          </motion.section>
          <motion.div {...entrance(3)} className="owner-health">
            {p.health}
          </motion.div>
        </div>
        <details className="owner-more">
          <summary>
            Activity details & company analysis{" "}
            <span aria-hidden="true">↗</span>
          </summary>
          {p.intelligence}
        </details>
        <span role="status" className="sr-only">
          {receipts[0]
            ? `${receipts[0].title} approved and available in company knowledge.`
            : ""}
        </span>
      </div>
    </LayoutGroup>
  );
}

function DecisionRow({
  item,
  expanded,
  onToggle,
  onResolved,
}: {
  item: NeedsYouItem;
  expanded: boolean;
  onToggle: () => void;
  onResolved: (title: string, approved: boolean) => void;
}) {
  const reduced = useProductReducedMotion();
  const present = useIsPresent();
  const router = useRouter();
  const feedback = useActionFeedback();
  const panelId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [answerReceipt, setAnswerReceipt] = useState<{
    title: string;
    approved: boolean;
  } | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const labels = {
    answer: "Needs an answer",
    approve: "Ready to approve",
    conflict: "Conflict",
    update: "Source or guidance changed",
  };
  const title =
    item.type === "question" || item.type === "external_question"
      ? item.summary
      : item.title;
  async function approve() {
    const success = await feedback.run(async () => {
      const response = await fetch(
        `/api/knowledge-proposals/${item.targetId}/approve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: item.metadata?.version,
            updatedAt: item.metadata?.updatedAt,
            knowledgeVersion: item.metadata?.knowledgeVersion ?? undefined,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true) {
        if (response.status === 409) router.refresh();
        throw new Error(
          body.error || "Approval wasn't saved. Please try again.",
        );
      }
    });
    if (success)
      timer.current = setTimeout(() => onResolved(item.title, true), 550);
  }
  return (
    <motion.article
      layout={reduced ? false : "position"}
      initial={false}
      exit={{ opacity: 0, height: 0, margin: 0 }}
      transition={uiTransition(reduced)}
      className="owner-decision"
      data-kind={item.kind}
      data-decision-id={item.id}
      data-state={answerReceipt ? "success" : feedback.state}
      inert={!present || undefined}
      aria-hidden={!present || undefined}
    >
      <button
        type="button"
        className="owner-decision-trigger"
        aria-expanded={expanded}
        aria-controls={panelId}
        disabled={feedback.state === "pending" || feedback.state === "success"}
        onClick={onToggle}
      >
        <span className="owner-status-rail" aria-hidden="true" />
        <span className="owner-decision-copy">
          <span className="owner-decision-meta">
            <span className="owner-status-label">
              {answerReceipt
                ? answerReceipt.approved
                  ? "Approved"
                  : "Answer sent"
                : feedback.state === "success"
                  ? "Approved"
                  : labels[item.kind]}
            </span>
            {item.priority === "now" ? (
              <span className="owner-priority">Priority</span>
            ) : null}
          </span>
          <strong>{title}</strong>
          <span className="owner-decision-context">
            {item.type === "question"
              ? item.detail || "An approved answer is missing."
              : item.detail || item.summary}
          </span>
          <span className="owner-decision-source">
            {item.source || "Company knowledge"}
          </span>
        </span>
        <span className="owner-row-action">
          {expanded ? "Close" : item.kind === "answer" ? "Answer" : "Review"}
          <span aria-hidden="true">→</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            className="owner-decision-detail"
            initial={{ opacity: 0, height: reduced ? "auto" : 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: reduced ? "auto" : 0 }}
            transition={uiTransition(reduced)}
          >
            <div className="owner-detail-inner">
              <p className="owner-eyebrow">
                {labels[item.kind]} · {item.source || "Company knowledge"}
              </p>
              <p className="owner-full-content">{item.summary}</p>
              {item.type === "question" ? (
                answerReceipt ? (
                  <div role="status">
                    <SuccessCheck variant="normal" />
                    <p>
                      {answerReceipt.approved ? "Approved" : "Answer sent"} ·{" "}
                      {answerReceipt.title}
                    </p>
                  </div>
                ) : (
                  <OwnerAnswer
                    questionId={item.targetId}
                    refreshOnResolved={false}
                    onResolved={(result) => {
                      setAnswerReceipt({
                        title: result.title,
                        approved: result.action === "approve",
                      });
                      timer.current = setTimeout(
                        () =>
                          onResolved(result.title, result.action === "approve"),
                        550,
                      );
                    }}
                  />
                )
              ) : (
                <>
                  <p>{item.detail}</p>
                  <div className="owner-decision-actions">
                    {item.type === "knowledge_proposal" &&
                    item.primaryAction === "accept" ? (
                      <OprynAction
                        label="Approve"
                        pendingLabel="Approving…"
                        successLabel="Approved"
                        arrow
                        state={feedback.state}
                        errorMessage={feedback.error}
                        onClick={() => void approve()}
                      />
                    ) : null}
                    <Link href={item.targetUrl}>Open full review →</Link>
                  </div>
                  <p className="owner-decision-disclosure">
                    Nothing becomes official until an authorized person approves
                    it.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
function channelName(origin?: string) {
  return origin === "slack"
    ? "Slack"
    : origin === "teams"
      ? "Microsoft Teams"
      : origin === "external_ai"
        ? "Connected AI"
        : "Team";
}
