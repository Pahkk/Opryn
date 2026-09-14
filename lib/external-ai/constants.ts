export const EXTERNAL_AI_SCOPES = [
  "knowledge:read",
  "processes:read",
  "policies:read",
  "sources:read",
  "escalations:create",
] as const;

export type ExternalAIScope = (typeof EXTERNAL_AI_SCOPES)[number];

export const EXTERNAL_AI_SOURCE_TYPES = [
  "process_summary",
  "process_step",
  "rule",
  "exception",
  "owner_answer",
  "role_instruction",
  "call_finding",
  "faq",
  "google_drive",
  "video_finding",
] as const;

export type ExternalAISourceType = (typeof EXTERNAL_AI_SOURCE_TYPES)[number];

export const KNOWLEDGE_CATEGORIES = [
  {
    id: "faqs",
    label: "FAQs",
    description: "Approved reusable answers to common questions.",
    sourceTypes: ["faq"],
  },
  {
    id: "processes",
    label: "Processes",
    description: "Approved process overviews, steps, and exceptions.",
    sourceTypes: ["process_summary", "process_step", "exception"],
  },
  {
    id: "google_drive",
    label: "Google Drive Knowledge",
    description: "Approved knowledge imported from connected Drive files.",
    sourceTypes: ["google_drive"],
  },
  {
    id: "rules",
    label: "Company Rules",
    description: "Approved policies and owner decisions.",
    sourceTypes: ["rule", "owner_answer"],
  },
  {
    id: "training",
    label: "Role Knowledge",
    description: "Approved instructions associated with employee roles.",
    sourceTypes: ["role_instruction"],
  },
  {
    id: "calls",
    label: "Approved Call Knowledge",
    description: "Reviewed findings learned from authorized calls.",
    sourceTypes: ["call_finding"],
  },
  {
    id: "videos",
    label: "Approved Video Knowledge",
    description: "Reviewed findings learned from process videos.",
    sourceTypes: ["video_finding"],
  },
] as const;
