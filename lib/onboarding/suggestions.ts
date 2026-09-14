import { z } from "zod";
import { industryIds } from "./industries";
export const setupSuggestionSchema = z.object({
  description: z.string().min(1).max(2000),
  industryId: z.enum(industryIds),
  explanation: z.string().max(300),
  departments: z.array(z.string().max(60)).max(5),
  knowledgeAreas: z
    .array(
      z.enum([
        "Policies",
        "Processes",
        "Pricing",
        "Products & Services",
        "Customer Support",
        "Sales",
        "Training",
        "Operations",
      ]),
    )
    .max(5),
  firstSource: z.enum(["google_workspace", "upload", "explain"]),
  sourceReason: z.string().max(250),
  firstQuestion: z.string().min(1).max(250),
});
export type SetupSuggestion = z.infer<typeof setupSuggestionSchema>;
