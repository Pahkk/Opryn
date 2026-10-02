"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";

/** One readable label. Only the decorative underline stretches; text never rolls or rotates. */
export function ActionLabel({
  children,
  emphasis = false,
  reduced = false,
}: {
  children: ReactNode;
  emphasis?: boolean;
  reduced?: boolean;
}) {
  return (
    <motion.span
      data-action-label="stable"
      style={{ display: "inline-block", position: "relative" }}
      variants={{ rest: { y: 0 }, hover: { y: emphasis && !reduced ? -1 : 0 } }}
      transition={uiTransition(reduced, motionTokens.duration.fast)}
    >
      {children}
      {emphasis && !reduced ? (
        <motion.span
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            borderRadius: 2,
            background: "currentColor",
            originX: 0,
            pointerEvents: "none",
          }}
          variants={{
            rest: { scaleX: 0, opacity: 0 },
            hover: { scaleX: 1, opacity: 0.65 },
          }}
          transition={{
            ...motionTokens.spring,
            opacity: uiTransition(false, motionTokens.duration.fast),
          }}
        />
      ) : null}
    </motion.span>
  );
}
