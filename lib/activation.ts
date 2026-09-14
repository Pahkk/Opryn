import { z } from "zod";
import { industryIds } from "./onboarding/industries";

export const activationStages = [
  "goal",
  "company",
  "teach",
  "review",
  "try",
  "plan",
] as const;
export const activationGoals = [
  ["answer_questions", "Reduce repeat questions"],
  ["train_people", "Train my team"],
  ["organize_knowledge", "Organize company knowledge"],
  ["ai_tools", "Give AI company context"],
  ["consistent_answers", "Keep company answers consistent"],
  ["everything", "Set up everything"],
] as const;
export const knowledgeAreas = [
  "Policies",
  "Processes",
  "Pricing",
  "Products & Services",
  "Customer Support",
  "Sales",
  "Training",
  "Operations",
];
export const companyProfileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  industry: z.string().trim().min(1).max(100),
  normalizedIndustryId: z.enum(industryIds).nullable().default(null),
  customIndustryLabel: z.string().trim().max(100).default(""),
  firstTeachQuestion: z.string().trim().max(250).default(""),
  recommendedSource: z
    .enum(["google_workspace", "upload", "explain"])
    .nullable()
    .default(null),
  sourceReason: z.string().trim().max(250).default(""),
  employee_count: z.number().int().min(1).max(100000),
  website: z
    .union([
      z.literal(""),
      z
        .url()
        .max(2000)
        .refine((v) => /^https?:\/\//i.test(v)),
    ])
    .default(""),
  departments: z.string().trim().max(500).default(""),
  knowledge_areas: z.array(z.string().max(80)).max(12).default([]),
  notes: z.string().trim().max(2000).default(""),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;
export const emptyCompany: CompanyProfile = {
  name: "",
  description: "",
  industry: "",
  normalizedIndustryId: null,
  customIndustryLabel: "",
  firstTeachQuestion: "",
  recommendedSource: null,
  sourceReason: "",
  employee_count: 1,
  website: "",
  departments: "",
  knowledge_areas: [],
  notes: "",
};
export function activationStage(step?: string | null) {
  if (step === "goals") return "goal";
  if (step === "setup") return "company";
  if (step === "test" || step === "complete" || step === "invite") return "try";
  return "teach";
}
