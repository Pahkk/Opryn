"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { SuccessCheck } from "./success-check";
/** Only mounted after server confirmation; no fabricated approval state. */
export function DecisionReceipt({
  children,
  previousHeight,
}: {
  children: ReactNode;
  previousHeight: number;
}) {
  const reduced = useProductReducedMotion();
  return (
    <motion.article
      className="review-result decision-receipt"
      role="status"
      data-motion-owner="motion"
      initial={reduced ? false : { height: previousHeight }}
      animate={{ height: "auto" }}
      transition={uiTransition(reduced)}
      style={{ overflow: "hidden" }}
    >
      <SuccessCheck variant="normal" />
      {children}
    </motion.article>
  );
}
