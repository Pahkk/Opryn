"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CircleHelp,
  Clock3,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
import { uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import "./product-workspace.css";

/** Text is authoritative; semantic colors never stand alone. No invented confidence score. */
export function ProductStatus({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone =
    status === "approved"
      ? "approved"
      : status === "conflict"
        ? "conflict"
        : ["needs_review", "review", "attention"].includes(status)
          ? "review"
          : "neutral";
  const Icon =
    tone === "approved"
      ? ShieldCheck
      : tone === "conflict"
        ? TriangleAlert
        : tone === "review"
          ? Clock3
          : CircleHelp;
  return (
    <span className={`product-status product-status-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {label ??
        (
          {
            approved: "Approved",
            needs_review: "Needs review",
            observed: "Observed",
            conflict: "Conflict",
            unknown: "Knowledge gap",
          } as Record<string, string>
        )[status] ??
        status}
    </span>
  );
}

/** Only mounted for an actual in-flight answer operation. No timed/fabricated stages. */
export function AnswerWorking({ working }: { working: boolean }) {
  const reduced = useProductReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {working ? (
        <motion.div
          key="working"
          className="answer-working"
          role="status"
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={uiTransition(reduced)}
          data-motion-owner="motion"
        >
          <OprynThinkingOrb
            state="searching"
            size={64}
            label="Searching approved knowledge"
            decorative
          />
          <div>
            <strong>Searching approved knowledge…</strong>
            <p>Checking the guidance your company has approved.</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DecisionWhy({
  kind,
  detail,
}: {
  kind: string;
  detail?: string;
}) {
  const Icon =
    kind === "conflict"
      ? TriangleAlert
      : kind === "approve"
        ? Check
        : CircleHelp;
  return (
    <div className="decision-why">
      <Icon size={14} aria-hidden="true" />
      <span>
        {detail ||
          (
            {
              answer: "Your expertise can close this knowledge gap.",
              approve:
                "A human decision is needed before this becomes guidance.",
              conflict:
                "The guidance disagrees. Opryn won't choose a rule for you.",
              update: "Check whether this guidance is still current.",
            } as Record<string, string>
          )[kind]}
      </span>
    </div>
  );
}
