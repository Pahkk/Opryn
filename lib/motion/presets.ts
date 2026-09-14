/** Seconds; CSS hover/focus states continue to use the existing CSS tokens. */
export const motion = {
  duration: { micro: 0.15, fast: 0.21, standard: 0.3, emphasis: 0.46, story: 0.8 },
  ease: {
    enter: "power2.out",
    state: "power1.out",
    drawer: "power3.out",
    exit: "power1.inOut",
  },
  distance: { page: 12, row: 6, sheet: 24 },
  stagger: 0.045,
} as const;
