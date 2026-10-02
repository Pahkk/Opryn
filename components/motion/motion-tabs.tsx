"use client";
import { useId, type ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Namespaces layoutId to the local set; never shares identity across routes/portals. */
export function MotionTabs({ children }: { children: ReactNode }) {
  const id = useId();
  return <LayoutGroup id={id}>{children}</LayoutGroup>;
}
export function ActiveIndicator() {
  const reduced = useProductReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className="motion-active-indicator"
      layoutId={reduced ? undefined : "active"}
      data-motion-owner="motion"
      transition={reduced ? { duration: 0 } : motionTokens.spring}
    />
  );
}
