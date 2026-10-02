import type { TrainingKnowledge } from "./model";
/** Deterministic draft: company facts are quoted, never generated. Situations are hypothetical. */
export function suggestedPractice(
  k: Pick<TrainingKnowledge, "content" | "library_category">,
) {
  const amount = k.content.match(/\$([\d,]+(?:\.\d{1,2})?)/);
  const hypothetical = amount
    ? Number(amount[1].replaceAll(",", "")) + 250
    : null;
  const category = k.library_category;
  const prompts: Record<string, { format: string; prompt: string }> = {
    policy: {
      format: "scenario",
      prompt:
        hypothetical && /refund/i.test(k.content)
          ? `Hypothetical practice: A customer requests a $${hypothetical.toLocaleString("en-US")} refund. What should you do under the approved guidance? Include any required approval.`
          : "A teammate asks you to make an exception to this policy. Explain what the approved guidance permits and when you must ask for help.",
    },
    process: {
      format: "step_order",
      prompt:
        "Put the actions in the order you would perform them. Include the approval or escalation steps stated in the guidance.",
    },
    faq: {
      format: "short_answer",
      prompt:
        "How would you answer this question for a teammate using only the approved guidance?",
    },
    decision: {
      format: "scenario",
      prompt:
        "You need to apply this decision to a new situation. Explain when it applies and what you would do if the situation falls outside the approved guidance.",
    },
    responsibility: {
      format: "responsibility",
      prompt:
        "Who owns this responsibility, and when should you involve them according to the guidance?",
    },
    definition: {
      format: "recognition",
      prompt:
        "Explain this term in your own words without adding company rules.",
    },
  };
  return {
    ...(prompts[category] ?? {
      format: "acknowledgement",
      prompt: "Read and acknowledge the current approved guidance.",
    }),
    quote: k.content.slice(0, 4000),
  };
}
