"use client";

import { ThinkingOrb } from "thinking-orbs";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

export type OprynThinkingState =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";

export function OprynThinkingOrb({
  state,
  size = 64,
  label,
  decorative = false,
  theme = "light",
}: {
  state: OprynThinkingState;
  size?: 20 | 64;
  label: string;
  decorative?: boolean;
  theme?: "light" | "dark" | "auto";
}) {
  const reduced = useProductReducedMotion();
  return (
    <span
      className={`opryn-thinking-orb opryn-thinking-orb-${size}`}
      aria-hidden={decorative || undefined}
    >
      <ThinkingOrb
        state={state}
        size={size}
        theme={theme}
        paused={reduced}
        aria-label={decorative ? undefined : label}
      />
    </span>
  );
}
