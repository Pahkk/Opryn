export type AnsweredWorkQuestion = {
  id: string;
  asked_by: string | null;
  question: string;
  origin: string;
  status: string;
  answered_by_opryn: boolean;
  escalated: boolean;
  created_at: string;
};

/** Conservative estimate, not a claim that a person would have interrupted an owner.
 * Deduplicate the same person's exact normalized question on the same UTC day.
 * Do not merge different thresholds, customer types, or one-time exceptions.
 */
export function estimateReturnedTime(
  questions: AnsweredWorkQuestion[],
  employeeIds: Set<string>,
  negativeFeedbackIds: Set<string>,
  averageMinutes: number,
) {
  const seen = new Set<string>();
  const eligible = questions.filter((question) => {
    if (
      !question.asked_by ||
      !employeeIds.has(question.asked_by) ||
      !["employee", "web", "slack", "teams"].includes(question.origin) ||
      !question.answered_by_opryn ||
      question.status !== "answered" ||
      question.escalated ||
      negativeFeedbackIds.has(question.id)
    )
      return false;
    const key = `${question.asked_by}:${question.created_at.slice(0, 10)}:${question.question.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const minutesPerQuestion =
    Number.isFinite(averageMinutes) && averageMinutes > 0
      ? Math.min(averageMinutes, 30)
      : 3;
  return {
    count: eligible.length,
    minutes: Math.round(eligible.length * minutesPerQuestion),
    minutesPerQuestion,
  };
}
