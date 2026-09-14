import { z } from "zod";

export const accountChangesSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).optional(),
    timezone: z
      .string()
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      })
      .optional(),
    locale: z.enum(["en-US", "en-GB", "en-CA", "en-AU"]).optional(),
    density: z.enum(["comfortable", "compact"]).optional(),
    motion: z.enum(["system", "reduced"]).optional(),
    notify_questions: z.boolean().optional(),
    notify_reviews: z.boolean().optional(),
    notify_answers: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

export type AccountSettings = {
  display_name: string | null;
  timezone: string;
  timezone_overridden: boolean;
  locale: "en-US" | "en-GB" | "en-CA" | "en-AU";
  density: "comfortable" | "compact";
  motion: "system" | "reduced";
  notify_questions: boolean;
  notify_reviews: boolean;
  notify_answers: boolean;
  avatar_path: string | null;
  avatar_hidden: boolean;
  revision: number;
};
export const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  display_name: null,
  timezone: "UTC",
  timezone_overridden: false,
  locale: "en-US",
  density: "comfortable",
  motion: "system",
  notify_questions: true,
  notify_reviews: true,
  notify_answers: true,
  avatar_path: null,
  avatar_hidden: false,
  revision: 1,
};

export function isQuestionTaskNotification(type: string) {
  return [
    "owner_question",
    "expert_question",
    "employee_question",
    "expert_answer_needed",
    "question_escalated",
  ].includes(type);
}

/** Controls implemented in-app delivery only. Never suppress unclassified/security events. */
export function shouldShowNotification(
  type: string,
  settings: AccountSettings,
) {
  if (isQuestionTaskNotification(type) || type === "external_ai_escalation")
    return settings.notify_questions;
  if (
    [
      "rule_needs_approval",
      "process_needs_approval",
      "knowledge_needs_review",
      "source_changed",
      "ai_process_created",
    ].includes(type)
  )
    return settings.notify_reviews;
  if (type === "question_answered") return settings.notify_answers;
  return true;
}
