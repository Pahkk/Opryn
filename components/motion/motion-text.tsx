"use client";
import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

/** One stable accessible heading. SSR stays visible; no character scrambling or loops. */
export function MotionWords({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduced = useProductReducedMotion();
  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, index) => (
          <span
            key={`${word}-${index}`}
            style={{
              display: "inline-block",
              overflow: "clip",
              verticalAlign: "bottom",
              paddingBottom: ".1em",
              marginBottom: "-.1em",
            }}
          >
            <motion.span
              style={{ display: "inline-block" }}
              initial={false}
              animate={
                seen && !reduced
                  ? { y: [8, 0], opacity: [0.65, 1] }
                  : { y: 0, opacity: 1 }
              }
              transition={{
                ...uiTransition(reduced, motionTokens.duration.emphasis),
                delay: reduced
                  ? 0
                  : Math.min(index * motionTokens.stagger, 0.18),
              }}
            >
              {word}
              {"\u00a0"}
            </motion.span>
          </span>
        ))}
      </span>
    </span>
  );
}
