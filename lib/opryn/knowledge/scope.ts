import { z } from "zod";

export const scopeDimensions = [
  "roles",
  "departments",
  "regions",
  "locations",
  "customerTypes",
  "plans",
  "products",
  "channels",
] as const;
const values = z.array(z.string().trim().min(1).max(120)).max(20);
export const knowledgeScopeSchema = z
  .object({
    roles: values.optional(),
    departments: values.optional(),
    regions: values.optional(),
    locations: values.optional(),
    customerTypes: values.optional(),
    plans: values.optional(),
    products: values.optional(),
    channels: values.optional(),
    effectiveFrom: z.iso.date().optional(),
    effectiveUntil: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (s) =>
      !s.effectiveFrom ||
      !s.effectiveUntil ||
      s.effectiveFrom <= s.effectiveUntil,
    "Effective end must follow start",
  );
export const scopeContextSchema = z
  .object({
    roles: values.optional(),
    departments: values.optional(),
    regions: values.optional(),
    locations: values.optional(),
    customerTypes: values.optional(),
    plans: values.optional(),
    products: values.optional(),
    channels: values.optional(),
  })
  .strict();
export type KnowledgeScope = z.infer<typeof knowledgeScopeSchema>;
export type ScopeContext = z.infer<typeof scopeContextSchema>;
const normalize = (v: string) => v.trim().toLocaleLowerCase("en-US");

/** Conservative: false only when applicability is demonstrably disjoint. */
export function knowledgeScopesOverlap(a: KnowledgeScope, b: KnowledgeScope) {
  if (
    (a.effectiveUntil &&
      b.effectiveFrom &&
      a.effectiveUntil < b.effectiveFrom) ||
    (b.effectiveUntil && a.effectiveFrom && b.effectiveUntil < a.effectiveFrom)
  )
    return false;
  return scopeDimensions.every((dimension) => {
    const x = a[dimension] ?? [],
      y = b[dimension] ?? [];
    return (
      !x.length ||
      !y.length ||
      x.some((v) => y.some((w) => normalize(v) === normalize(w)))
    );
  });
}

/** Applicability never grants access. Permission filtering happens before this matcher. */
export function matchKnowledgeScope(
  scope: KnowledgeScope,
  context: ScopeContext,
  date = new Date().toISOString().slice(0, 10),
) {
  if (
    (scope.effectiveFrom && date < scope.effectiveFrom) ||
    (scope.effectiveUntil && date > scope.effectiveUntil)
  )
    return { status: "outside_scope" as const, missing: [] };
  const missing: string[] = [];
  for (const dimension of scopeDimensions) {
    const required = scope[dimension] ?? [];
    if (!required.length) continue;
    const actual = context[dimension] ?? [];
    if (!actual.length) missing.push(dimension);
    else if (
      !actual.some((v) => required.some((r) => normalize(r) === normalize(v)))
    )
      return { status: "outside_scope" as const, missing: [] };
  }
  return {
    status: missing.length
      ? ("needs_clarification" as const)
      : ("matches" as const),
    missing,
  };
}
