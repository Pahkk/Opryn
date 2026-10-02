import { z } from "zod";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-library";
const category = z.enum(
  Object.keys(KNOWLEDGE_CATEGORIES) as [
    keyof typeof KNOWLEDGE_CATEGORIES,
    ...Array<keyof typeof KNOWLEDGE_CATEGORIES>,
  ],
);
export const externalKnowledgePolicySchema = z
  .object({
    mode: z.enum(["inherit", "subjects", "items"]),
    subjects: z.array(category).max(200).default([]),
    knowledgeIds: z.array(z.uuid()).max(200).default([]),
    excludedSubjects: z.array(category).max(200).default([]),
  })
  .strict();
export type ExternalKnowledgePolicy = z.infer<
  typeof externalKnowledgePolicySchema
>;
/** Additional restriction; existing scope/category access and trust still apply. */
export function externalPolicyAllows(
  policy: unknown,
  item: { id: string; library_category?: string },
) {
  const result = externalKnowledgePolicySchema.safeParse(
    policy ?? { mode: "inherit" },
  );
  if (!result.success) return false;
  const p = result.data;
  const category = item.library_category ?? "uncategorized";
  if (p.excludedSubjects.some((s) => s === category)) return false;
  return (
    p.mode === "inherit" ||
    (p.mode === "subjects"
      ? p.subjects.some((s) => s === category)
      : p.knowledgeIds.includes(item.id))
  );
}
