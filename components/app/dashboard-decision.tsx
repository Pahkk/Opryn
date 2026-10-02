"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, LayoutGroup } from "motion/react";
import { OwnerAnswer } from "./owner-answer";
import { uiTransition, motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

/** Uses the existing approval service. The receipt appears only after server success. */
export function DashboardDecision({
  questionId,
  question,
  fallback,
}: {
  questionId?: string;
  question?: string;
  fallback?: ReactNode;
}) {
  const [result, setResult] = useState<{
    action: "approve" | "answer_only" | "request_approval";
    title: string;
  } | null>(null);
  const reduced = useProductReducedMotion();
  if (!result && !questionId) return fallback;
  return (
    <LayoutGroup id="dashboard-decision">
      <motion.div
        layout={!reduced}
        transition={reduced ? { duration: 0 } : motionTokens.layout}
        className="mt-6 border-l-2 border-[#d2d8de] pl-4"
        data-motion-owner="motion"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {!result ? (
            <motion.div
              key="decision"
              exit={{ opacity: 0 }}
              transition={uiTransition(reduced)}
            >
              <p className="text-xs font-semibold text-[var(--opryn-coral)]">
                Answer needed
              </p>
              <motion.p
                layoutId={reduced ? undefined : "subject"}
                className="mt-2 text-sm font-medium leading-6"
              >
                {question}
              </motion.p>
              <OwnerAnswer questionId={questionId!} onResolved={setResult} />
            </motion.div>
          ) : (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={uiTransition(reduced)}
              role="status"
            >
              <p className="text-xs font-semibold">
                {result.action === "approve"
                  ? "✓ Approved · added to company knowledge"
                  : result.action === "request_approval"
                    ? "Answer sent · awaiting review"
                    : "Answer sent"}
              </p>
              <motion.p
                layoutId={reduced ? undefined : "subject"}
                className="mt-2 text-sm font-medium leading-6"
              >
                {result.title}
              </motion.p>
              {result.action === "approve" && (
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-[var(--opryn-blue)]"
                  href="/app/processes?view=recent"
                >
                  View recent knowledge →
                </Link>
              )}
              {questionId && (
                <button
                  className="mt-3 min-h-11 text-sm"
                  onClick={() => setResult(null)}
                >
                  Next question
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  );
}
