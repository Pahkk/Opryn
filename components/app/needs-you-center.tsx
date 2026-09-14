"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MotionRegion } from "@/components/motion/motion-region";
import { MotionNumber } from "@/components/motion/motion-number";
import { DecisionReceipt } from "@/components/motion/decision-receipt";
import { SelectionTrack } from "@/components/motion/selection-track";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";
import { ArrowRight, Check, X } from "lucide-react";
import { OwnerAnswer } from "@/components/app/owner-answer";
import type { NeedsYouItem, NeedsYouKind } from "@/lib/opryn/needs-you";
import { showAppToast } from "@/lib/client-toast";
import { DialogSurface } from "@/components/app/dialog-surface";
import { WorkspaceNotice } from "@/components/app/workspace-context";

type Filter = "all" | NeedsYouKind;

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "answer", label: "Answer" },
  { id: "approve", label: "Approve" },
  { id: "conflict", label: "Conflicts" },
  { id: "update", label: "Updates" },
];

export function NeedsYouCenter({
  initialItems,
  initialItemId,
  initialFilter,
}: {
  initialItems: NeedsYouItem[];
  initialItemId: string | null;
  initialFilter: string | null;
}) {
  const router = useRouter();
  const queueRef = useRef<HTMLDivElement>(null);
  const clearCleanup = useRef<(() => void) | null>(null);
  const decisionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (decisionTimer.current) clearTimeout(decisionTimer.current);
    },
    [],
  );
  const [clearing, setClearing] = useState(false);
  useEffect(() => () => clearCleanup.current?.(), []);
  const [decisionError, setDecisionError] = useState("");
  const [resolved, setResolved] = useState<
    Record<string, { title: string; height: number }>
  >({});
  const [items, setItems] = useState(initialItems);
  const [lastInitialItems, setLastInitialItems] = useState(initialItems);
  if (lastInitialItems !== initialItems) {
    setLastInitialItems(initialItems);
    // Retain compact server-confirmed receipts until explicitly cleared.
    const incoming = new Map(initialItems.map((item) => [item.id, item]));
    const present = new Set(items.map((item) => item.id));
    setItems([
      ...items.flatMap((item) =>
        resolved[item.id]
          ? [item]
          : incoming.has(item.id)
            ? [incoming.get(item.id)!]
            : [],
      ),
      ...initialItems.filter((item) => !present.has(item.id)),
    ]);
  }
  const [filter, setFilter] = useState<Filter>(() =>
    filters.some((item) => item.id === initialFilter)
      ? (initialFilter as Filter)
      : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialItemId);
  const [previousItemId, setPreviousItemId] = useState(initialItemId);
  if (previousItemId !== initialItemId) {
    setPreviousItemId(initialItemId);
    setSelectedId(initialItemId);
  }
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const visibleItems = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.kind === filter),
    [filter, items],
  );
  const selected =
    items.find(
      (item) => item.id === selectedId || item.targetId === selectedId,
    ) ?? null;
  const counts = useMemo(
    () =>
      items.reduce(
        (result, item) => {
          if (!resolved[item.id]) result[item.kind] += 1;
          return result;
        },
        { answer: 0, approve: 0, conflict: 0, update: 0 },
      ),
    [items, resolved],
  );

  async function resolveProposal(
    item: NeedsYouItem,
    decision: "approve" | "deny",
  ) {
    if (resolvingId) return;
    setDecisionError("");
    setResolvingId(item.id);
    try {
      const response = await fetch(
        `/api/knowledge-proposals/${item.targetId}/${decision}`,
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
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 409) router.refresh();
        throw new Error(body.error || "That decision was not saved.");
      }
      finishItem(
        item,
        decision === "approve" ? "Opryn knows this now." : "Not added.",
        decision === "approve"
          ? "Your team and connected AI can use it now."
          : "Opryn won't use this as company policy.",
      );
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "This decision wasn't saved. Please try again.",
      );
      setResolvingId(null);
      showAppToast(
        "That decision wasn't saved.",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }

  async function resolveReviewAction(
    item: NeedsYouItem,
    payload: Record<string, string | number>,
    message: string,
  ) {
    if (resolvingId) return;
    setDecisionError("");
    setResolvingId(item.id);
    try {
      const response = await fetch("/api/learning-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "That review was not saved.");
      finishItem(item, message, "Opryn updated the action center.");
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "This decision wasn't saved. Please try again.",
      );
      setResolvingId(null);
      showAppToast(
        "That review wasn't saved.",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }

  async function denyProcess(item: NeedsYouItem) {
    if (resolvingId) return;
    setDecisionError("");
    setResolvingId(item.id);
    try {
      const response = await fetch(`/api/processes/${item.targetId}/deny`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "That process was not denied.");
      finishItem(
        item,
        "Process not added.",
        "Opryn won't use it as an official company process.",
      );
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "This decision wasn't saved. Please try again.",
      );
      setResolvingId(null);
      showAppToast(
        "That decision wasn't saved.",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  }

  function finishItem(item: NeedsYouItem, title: string, detail: string) {
    const height =
      document.getElementById(`action-${item.id}`)?.getBoundingClientRect()
        .height ?? 150;
    setResolved((current) => ({ ...current, [item.id]: { title, height } }));
    queueRef.current
      ?.querySelector<HTMLButtonElement>(".needs-you-filters button")
      ?.focus({ preventScroll: true });
    showAppToast(title, detail);
    // Keep decision controls disabled while the receipt collapses so a double
    // click cannot approve a different item as it moves under the pointer.
    setResolvingId(item.id);
    if (decisionTimer.current) clearTimeout(decisionTimer.current);
    decisionTimer.current = setTimeout(() => setResolvingId(null), 350);
    setSelectedId(null);
    router.refresh();
  }

  const remaining = items.filter((item) => !resolved[item.id]).length;

  return (
    <div className="needs-you-center" ref={queueRef} data-guide="review.queue">
      {decisionError && !selected ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-[#eed5d7] bg-[#fff4f4] p-4 text-sm text-[#99424b]"
        >
          {decisionError}
        </p>
      ) : null}
      <header className="needs-you-hero">
        <div>
          <h1 className="opryn-page-title">Needs You</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--opryn-muted)]">
            Opryn handled the rest. These need your input.
          </p>
        </div>
        <div
          className="needs-you-count"
          aria-label={`${remaining} items need you`}
        >
          <strong>
            <MotionNumber value={remaining} />
          </strong>
          <span>{remaining === 1 ? "item" : "items"}</span>
        </div>
      </header>

      <section className="needs-you-summary" aria-label="Needs You summary">
        <SummaryMetric label="Answers" value={counts.answer} tone="answer" />
        <SummaryMetric
          label="Approvals"
          value={counts.approve}
          tone="approve"
        />
        <SummaryMetric
          label="Conflicts"
          value={counts.conflict}
          tone="conflict"
        />
        <SummaryMetric label="Updates" value={counts.update} tone="update" />
      </section>

      <SelectionTrack value={filter}>
        <div
          className="needs-you-filters"
          role="group"
          aria-label="Filter action items"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={filter === item.id ? "is-active" : ""}
            >
              {item.label}
            </button>
          ))}
        </div>
      </SelectionTrack>

      {Object.keys(resolved).length ? (
        <button
          type="button"
          className="mt-4 min-h-11 text-sm font-semibold text-[var(--opryn-blue)]"
          disabled={clearing}
          onClick={() => {
            if (clearing || !queueRef.current) return;
            setClearing(true);
            // Move focus to a stable control before removing completed rows.
            queueRef.current
              .querySelector<HTMLButtonElement>(".needs-you-filters button")
              ?.focus({ preventScroll: true });
            const scope = motionScope(queueRef.current);
            scope.run(() =>
              gsap.to(queueRef.current!.querySelectorAll(".review-result"), {
                opacity: 0,
                y: -6,
                minHeight: 0,
                height: 0,
                margin: 0,
                padding: 0,
                overflow: "hidden",
                duration: motion.duration.fast,
                ease: motion.ease.exit,
              }),
            );
            // State removal has a bounded fallback independent of GSAP completion.
            const timer = window.setTimeout(() => {
              scope.dispose();
              setItems((current) =>
                current.filter((item) => !resolved[item.id]),
              );
              setResolved({});
              setClearing(false);
              clearCleanup.current = null;
            }, motion.duration.fast * 1000);
            clearCleanup.current = () => {
              clearTimeout(timer);
              scope.dispose();
            };
          }}
        >
          {remaining} left · Clear completed decisions
        </button>
      ) : null}

      {visibleItems.length ? (
        <div className="mt-7 space-y-9">
          {(["now", "soon", "can_wait"] as const).map((priority) => {
            const group = visibleItems.filter(
              (item) => item.priority === priority,
            );
            if (!group.length) return null;
            return (
              <section key={priority} aria-labelledby={`needs-you-${priority}`}>
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    id={`needs-you-${priority}`}
                    className="text-sm font-semibold text-[var(--opryn-navy)]"
                  >
                    {priorityLabel(priority)}
                  </h2>
                  <span className="h-px flex-1 bg-[var(--opryn-line)]" />
                </div>
                <div className="space-y-3">
                  {group.map((item) =>
                    resolved[item.id] ? (
                      <DecisionReceipt
                        key={item.id}
                        previousHeight={resolved[item.id].height}
                      >
                        <MotionRegion variant="status">
                          <p className="font-semibold text-[var(--opryn-blue)]">
                            {resolved[item.id].title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--opryn-muted)]">
                            {item.title}
                          </p>
                        </MotionRegion>
                      </DecisionReceipt>
                    ) : (
                      <NeedsYouCard
                        key={item.id}
                        item={item}
                        busy={resolvingId !== null}
                        leaving={false}
                        onOpen={() => setSelectedId(item.id)}
                        onAccept={() => void resolveProposal(item, "approve")}
                        onDeny={() => void resolveProposal(item, "deny")}
                      />
                    ),
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="needs-you-empty">
          <span>
            <Check />
          </span>
          <h2>Opryn doesn&apos;t need anything from you right now.</h2>
          <p>When a real decision needs your input, it will appear here.</p>
          {filter !== "all" ? (
            <button type="button" onClick={() => setFilter("all")}>
              Show all items
            </button>
          ) : null}
        </div>
      )}

      {selected ? (
        <ReviewSheet
          error={decisionError}
          item={selected}
          busy={resolvingId === selected.id}
          onClose={() => setSelectedId(null)}
          onAccept={() => void resolveProposal(selected, "approve")}
          onDeny={() =>
            selected.type === "process"
              ? void denyProcess(selected)
              : void resolveProposal(selected, "deny")
          }
          onQuestionResolved={() =>
            finishItem(
              selected,
              "Answer sent.",
              "Opryn no longer needs your input on this question.",
            )
          }
          onReviewAction={(payload, message) =>
            void resolveReviewAction(selected, payload, message)
          }
        />
      ) : null}
    </div>
  );
}

function NeedsYouCard({
  item,
  busy,
  leaving,
  onOpen,
  onAccept,
  onDeny,
}: {
  item: NeedsYouItem;
  busy: boolean;
  leaving: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDeny: () => void;
}) {
  const quickApproval =
    item.type === "knowledge_proposal" &&
    item.primaryAction === "accept" &&
    item.summary.length <= 600;
  return (
    <article
      id={`action-${item.id}`}
      className={`needs-you-card needs-you-${item.kind} ${leaving ? "is-resolved" : ""}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
        aria-label={`Review ${item.title}`}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="needs-you-kind">{kindLabel(item.kind)}</span>
          {item.source ? (
            <span className="text-[var(--opryn-faint)]">{item.source}</span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-[-.025em] text-[var(--opryn-navy)]">
          {item.title}
        </h3>
        <p
          className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--opryn-muted)] ${quickApproval ? "" : "line-clamp-3"}`}
        >
          {item.summary}
        </p>
      </button>
      <div className="needs-you-card-actions">
        {quickApproval ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onAccept}
              className="opryn-action min-w-[104px] justify-center"
            >
              {busy ? "Adding…" : "Accept"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDeny}
              className="opryn-button-secondary min-h-11 px-4"
            >
              Deny
            </button>
          </>
        ) : item.type === "process" ||
          (item.type === "knowledge_proposal" &&
            item.metadata?.reviewRequired &&
            item.metadata?.relatedProcessId) ? (
          <Link href={item.targetUrl} className="opryn-action justify-center">
            Review <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="opryn-action justify-center"
          >
            {item.type === "knowledge_proposal"
              ? "Review"
              : actionLabel(item.primaryAction)}{" "}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </article>
  );
}

function ReviewSheet({
  error,
  item,
  busy,
  onClose,
  onAccept,
  onDeny,
  onQuestionResolved,
  onReviewAction,
}: {
  error: string;
  item: NeedsYouItem;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDeny: () => void;
  onQuestionResolved: () => void;
  onReviewAction: (
    payload: Record<string, string | number>,
    message: string,
  ) => void;
}) {
  return (
    <DialogSurface
      className="dialog-review"
      onClose={onClose}
      labelledBy="needs-you-sheet-title"
      busy={busy}
    >
      <aside className="needs-you-sheet">
        <header>
          <div>
            <p className="opryn-section-label">{kindLabel(item.kind)}</p>
            <h2 id="needs-you-sheet-title">{item.title}</h2>
            <WorkspaceNotice action="Reviewing for" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close review"
            className="needs-you-sheet-close"
          >
            <X />
          </button>
        </header>
        <div className="needs-you-sheet-body">
          {item.type === "knowledge_proposal" &&
          item.primaryAction === "accept" ? (
            <p className="mb-5 text-sm leading-6 text-[var(--opryn-muted)]">
              Accept makes this available to people and AI connections with
              access.
            </p>
          ) : null}
          {item.metadata?.currentContent ? (
            <ReviewBlock
              label={`Current approved version ${item.metadata.knowledgeVersion}`}
            >
              <p className="whitespace-pre-wrap">
                {String(item.metadata.currentContent)}
              </p>
            </ReviewBlock>
          ) : null}
          <ReviewBlock
            label={
              item.metadata?.currentContent
                ? "Suggested replacement"
                : "What Opryn found"
            }
          >
            <p className="text-base font-medium leading-7 text-[var(--opryn-navy)]">
              {item.summary}
            </p>
          </ReviewBlock>
          {item.type === "question" ? (
            <OwnerAnswer
              questionId={item.targetId}
              onResolved={onQuestionResolved}
            />
          ) : null}
          {item.source ? (
            <ReviewBlock label="Source">
              <p>{item.source}</p>
            </ReviewBlock>
          ) : null}
          {item.detail ? (
            <ReviewBlock label="Why Opryn needs you">
              <p>{item.detail}</p>
            </ReviewBlock>
          ) : null}
          {item.type === "conflict" ? (
            <div className="space-y-3">
              <ReviewBlock label="First answer">
                <p>
                  {String(
                    item.metadata?.firstContent || "First approved answer",
                  )}
                </p>
              </ReviewBlock>
              <ReviewBlock label="Second answer">
                <p>
                  {String(
                    item.metadata?.secondContent || "Second approved answer",
                  )}
                </p>
              </ReviewBlock>
            </div>
          ) : null}
        </div>
        {error ? (
          <p
            role="alert"
            className="m-4 rounded-xl border border-[#eed5d7] bg-[#fff4f4] p-3 text-sm text-[#99424b]"
          >
            {error}
          </p>
        ) : null}
        {item.type !== "question" ? (
          <footer className="needs-you-sheet-actions">
            {item.type === "knowledge_proposal" ? (
              item.primaryAction === "accept" ||
              (item.metadata?.currentContent &&
                !item.metadata?.reviewRequired) ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onAccept}
                    className="opryn-action justify-center"
                  >
                    {busy
                      ? "Adding…"
                      : item.metadata?.currentContent
                        ? "Accept Update"
                        : "Accept"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDeny}
                    className="opryn-button-secondary min-h-11 px-4"
                  >
                    Deny
                  </button>
                  {item.metadata?.relatedProcessId ? (
                    <Link
                      href={`/app/processes/${String(item.metadata.relatedProcessId)}?review=true&returnTo=%2Fapp%2Fneeds-you`}
                      className="opryn-button-secondary inline-flex min-h-11 items-center justify-center px-4"
                    >
                      Edit
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  <Link
                    href={item.targetUrl}
                    className="opryn-action justify-center"
                  >
                    Review in Opryn
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onDeny}
                    className="opryn-button-secondary min-h-11 px-4"
                  >
                    Deny
                  </button>
                </>
              )
            ) : item.type === "process" ? (
              <>
                <Link
                  href={item.targetUrl}
                  className="opryn-action justify-center"
                >
                  Review
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDeny}
                  className="opryn-button-secondary min-h-11 px-4"
                >
                  Deny
                </button>
              </>
            ) : item.type === "conflict" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onReviewAction(
                      {
                        action: "resolve_conflict",
                        conflictId: item.targetId,
                        resolution: "use_first",
                      },
                      "First answer kept.",
                    )
                  }
                  className="opryn-action justify-center"
                >
                  Use First
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onReviewAction(
                      {
                        action: "resolve_conflict",
                        conflictId: item.targetId,
                        resolution: "use_second",
                      },
                      "Second answer kept.",
                    )
                  }
                  className="opryn-button-secondary min-h-11 px-4"
                >
                  Use Second
                </button>
                {item.metadata?.conflictType === "possible_duplicate" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onReviewAction(
                        {
                          action: "resolve_conflict",
                          conflictId: item.targetId,
                          resolution: "keep_both",
                        },
                        "Both answers kept.",
                      )
                    }
                    className="opryn-button-secondary min-h-11 px-4"
                  >
                    Keep Both
                  </button>
                ) : null}
              </>
            ) : item.type === "freshness" ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onReviewAction(
                      {
                        action: "confirm_knowledge",
                        knowledgeId: item.targetId,
                        version: Number(item.metadata?.version),
                      },
                      "Still accurate.",
                    )
                  }
                  className="opryn-action justify-center"
                >
                  Still Accurate
                </button>
                <Link
                  href={
                    item.metadata?.processId
                      ? `/app/processes/${item.metadata.processId}?review=true`
                      : `/app/knowledge/${item.targetId}/history`
                  }
                  className="opryn-button-secondary inline-flex min-h-11 items-center justify-center px-4"
                >
                  Update Knowledge
                </Link>
              </>
            ) : item.type === "feedback" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onReviewAction(
                    { action: "resolve_feedback", feedbackId: item.targetId },
                    "Feedback resolved.",
                  )
                }
                className="opryn-action justify-center"
              >
                Mark Resolved
              </button>
            ) : (
              <Link
                href={item.targetUrl}
                className="opryn-action justify-center"
              >
                {actionLabel(item.primaryAction)}
              </Link>
            )}
          </footer>
        ) : null}
      </aside>
    </DialogSurface>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: NeedsYouKind;
}) {
  return (
    <div className={`needs-you-summary-item needs-you-${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ReviewBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="needs-you-review-block">
      <h3>{label}</h3>
      <div>{children}</div>
    </section>
  );
}

function priorityLabel(priority: NeedsYouItem["priority"]) {
  if (priority === "now") return "Needs attention now";
  if (priority === "soon") return "Review soon";
  return "Can wait";
}

function kindLabel(kind: NeedsYouKind) {
  if (kind === "answer") return "Answer";
  if (kind === "approve") return "Approve";
  if (kind === "conflict") return "Conflict";
  return "Update";
}

function actionLabel(action: NeedsYouItem["primaryAction"]) {
  if (action === "answer") return "Answer";
  if (action === "accept") return "Accept";
  if (action === "resolve") return "Resolve";
  if (action === "reconnect") return "Reconnect";
  return "Review";
}
