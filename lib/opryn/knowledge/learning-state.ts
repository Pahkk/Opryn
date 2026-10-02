export function learningState(
  a: {
    learning_state: string;
    acknowledged_process_updated_at: string | null;
    practiced_process_updated_at: string | null;
  },
  currentVersion: string,
) {
  if (a.practiced_process_updated_at === currentVersion) return "Practiced";
  if (a.acknowledged_process_updated_at === currentVersion)
    return "Acknowledged";
  return a.learning_state === "not_started"
    ? "Not started"
    : a.acknowledged_process_updated_at || a.practiced_process_updated_at
      ? "Updated — read again"
      : "Viewed";
}
