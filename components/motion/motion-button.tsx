"use client";
import { motion, type HTMLMotionProps } from "motion/react";
import { uiTransition, motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Standard controls only; destructive confirmations retain their immediate styling. */
export function MotionButton(props: HTMLMotionProps<"button">) {
  const reduced = useProductReducedMotion();
  return (
    <motion.button
      whileTap={reduced || props.disabled ? undefined : { scale: 0.98 }}
      transition={uiTransition(reduced, motionTokens.duration.micro)}
      {...props}
      data-motion-owner="motion"
    />
  );
}
