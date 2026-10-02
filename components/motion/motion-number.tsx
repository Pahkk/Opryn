"use client";
import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Starts at the real server value; AT receives only confirmed state. */
export function MotionNumber({ value }: { value: number }) {
  const reduced = useProductReducedMotion();
  const spring = useSpring(value, motionTokens.spring);
  const display = useTransform(spring, (current) =>
    String(Math.round(current)),
  );
  useEffect(() => {
    if (reduced) spring.jump(value);
    else spring.set(value);
  }, [value, reduced, spring]);
  return (
    <>
      <span className="sr-only">{value}</span>
      <motion.span
        aria-hidden="true"
        className="motion-number-value tabular-nums"
      >
        {display}
      </motion.span>
    </>
  );
}
