export const KNOWLEDGE_CATEGORIES = {
  policy: "Policies",
  process: "Processes",
  faq: "FAQs",
  pricing: "Pricing",
  product_service: "Products & Services",
  sales: "Sales",
  customer_support: "Customer Support",
  training: "Training",
  responsibility: "Responsibilities",
  decision: "Decisions",
  exception: "Exceptions",
  definition: "Definitions",
  uncategorized: "Uncategorized",
} as const;
export type KnowledgeCategory = keyof typeof KNOWLEDGE_CATEGORIES;
export type LibraryItem = {
  id: string;
  entity: "process" | "knowledge" | "proposal";
  title: string;
  content: string;
  category: KnowledgeCategory;
  tags: string[];
  revision: number;
  status: string;
  source: string;
  source_title: string | null;
  source_url: string | null;
  process_id: string | null;
  updated_at: string;
  confirmed_at: string | null;
  usage_count: number;
  version: number;
  review_required: boolean;
};
export const LIBRARY_VIEWS = {
  overview: "Overview",
  all: "All knowledge",
  needs_review: "Needs Review",
  recent: "Recently Updated",
  used: "Most Used",
  conflict: "Conflicts",
  uncategorized: "Uncategorized",
  outdated: "Potentially Outdated",
} as const;
/** Conservative title signals only. No historical metadata is rewritten. */
export function classifyKnowledge(title: string): KnowledgeCategory {
  const rules: [KnowledgeCategory, RegExp][] = [
    ["policy", /\bpolic(?:y|ies)\b/i],
    ["pricing", /\bpricing|price list|rate card\b/i],
    ["faq", /\bfaq|frequently asked\b/i],
    ["training", /\bonboarding|training\b/i],
    ["responsibility", /\bresponsibilit(?:y|ies)\b/i],
    ["decision", /\bdecision\b/i],
    ["exception", /\bexceptions?\b/i],
    ["definition", /\bglossary|definitions?\b/i],
    ["process", /\bprocess|procedure|workflow\b/i],
  ];
  const matches = rules.filter(([, pattern]) => pattern.test(title));
  return matches.length === 1 ? matches[0][0] : "uncategorized";
}
