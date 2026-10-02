"use client";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { uiTransition, motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Conditional expansion; focused controls are removed immediately on close. */
export function MotionPanel({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <PanelContent className={className} reduced={reduced}>
          {children}
        </PanelContent>
      )}
    </AnimatePresence>
  );
}
function PanelContent({
  children,
  className,
  reduced,
}: {
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      key="panel"
      className={className}
      inert={!present ? true : undefined}
      aria-hidden={!present ? true : undefined}
      data-motion-owner="motion"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={uiTransition(reduced)}
      style={{ overflow: "hidden" }}
    >
      <div>{children}</div>
    </motion.div>
  );
}
export function MotionHover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  return (
    <motion.div
      className={className}
      data-motion-owner="motion"
      whileHover={reduced ? undefined : { y: -1 }}
      transition={uiTransition(reduced, motionTokens.duration.micro)}
    >
      {children}
    </motion.div>
  );
}
