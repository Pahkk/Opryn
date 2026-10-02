import type { Transition } from "motion/react";

/** Product UI only. Timeline choreography keeps the GSAP presets. */
export const motionTokens = {
  duration: { micro: 0.14, fast: 0.2, standard: 0.26, emphasis: 0.42 },
  ease: [0.22, 1, 0.36, 1] as const,
  distance: { page: 8, row: 6, sheet: 24 },
  stagger: 0.045,
  spring: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 } as const,
  layout: { type: "spring", stiffness: 280, damping: 30 } as const,
};
export function uiTransition(
  reduced = false,
  duration: number = motionTokens.duration.standard,
): Transition {
  return {
    type: "tween",
    duration: reduced ? 0 : duration,
    ease: motionTokens.ease,
  };
}
