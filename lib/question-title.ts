export function summarizeQuestionTitle(question: string, maxLength = 88) {
  const normalized = question
    .replace(/^\s*<@[A-Z0-9]+>\s*[:,;-]?\s*/i, "")
    .replace(/^\s*@Opryn\b\s*[:,;-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!.]+$/g, "");

  if (!normalized) return "Team question";
  if (normalized.length <= maxLength) return normalized;

  const shortened = normalized.slice(0, maxLength + 1);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : maxLength).trim()}…`;
}
