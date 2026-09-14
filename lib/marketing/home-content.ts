// Editorial selection only; no implicit experiment or random assignment.
export const heroVariants = {
  A: {
    headline: "Teach your business once.",
    lines: [
      "Help your team get answers.",
      "Get new people up to speed.",
      "Give your agents company context.",
      "Keep knowledge in one place.",
    ],
  },
  B: {
    headline: "One place for everything your business knows.",
    lines: [
      "For your employees.",
      "For ChatGPT and Claude.",
      "For your call agents.",
      "For whatever comes next.",
    ],
  },
  C: {
    headline: "Give everyone the context of your business.",
    lines: ["Your team.", "Your AI.", "Your agents.", "One source of truth."],
  },
} as const;
export const activeHeroVariant: keyof typeof heroVariants = "A";
export const heroStaticLine =
  "Give your people and AI one approved source of company knowledge.";
