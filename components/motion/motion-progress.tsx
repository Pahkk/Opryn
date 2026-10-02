"use client";
import { useEffect } from "react";
import { motion, useSpring } from "motion/react";
import { motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
export function MotionProgress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  const fraction = Math.min(1, Math.max(0, value));
  const progress = useSpring(fraction, motionTokens.layout);
  useEffect(() => {
    if (reduced) progress.jump(fraction);
    else progress.set(fraction);
  }, [fraction, reduced, progress]);
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      data-motion-owner="motion"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        background: "currentColor",
        transformOrigin: "left",
        scaleX: progress,
      }}
    />
  );
}
