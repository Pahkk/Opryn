"use client";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { uiTransition, motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Brief status text only; never wrap an editable form or live answer stream. */
export function PresenceSwap({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  return (
    <span
      className={className}
      style={{ display: "inline-grid", position: "relative" }}
      data-motion-owner="motion"
    >
      <AnimatePresence initial={false}>
        <motion.span
          key={value}
          style={{ gridArea: "1 / 1" }}
          initial={{ opacity: 0, y: reduced ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduced ? 0 : -4 }}
          transition={uiTransition(reduced, motionTokens.duration.micro)}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
