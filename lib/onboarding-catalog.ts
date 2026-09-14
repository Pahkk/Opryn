export const BUSINESS_TYPE_GROUPS = [
  {
    label: "Trades & field services",
    options: [
      "HVAC",
      "Plumbing",
      "Electrical",
      "Construction",
      "Landscaping",
      "Roofing",
      "Cleaning Services",
      "Pest Control",
      "General Contracting",
      "Painting",
      "Flooring",
      "Pool Services",
      "Appliance Repair",
      "Home Inspection",
      "Restoration Services",
      "Security Systems",
    ],
  },
  {
    label: "Professional & digital",
    options: [
      "Software Development",
      "Marketing / Advertising",
      "Web Design / IT Services",
      "Accounting / Bookkeeping",
      "Consulting",
      "Professional Services",
      "E-commerce",
      "Law Firm",
      "Insurance Agency",
      "Real Estate",
      "Architecture / Engineering",
      "Staffing / Recruiting",
      "Photography / Creative Studio",
    ],
  },
  {
    label: "Local & operational",
    options: [
      "Auto Repair",
      "Trucking / Logistics",
      "Property Management",
      "Manufacturing",
      "Retail",
      "Restaurant / Hospitality",
      "Healthcare Practice",
      "Dental Practice",
      "Fitness / Wellness",
      "Childcare / Education",
      "Event Services",
      "Wholesale / Distribution",
      "Agriculture",
      "Nonprofit",
      "Other",
    ],
  },
] as const;

export const BUSINESS_TYPES = BUSINESS_TYPE_GROUPS.flatMap(
  (group) => group.options,
);

export const POPULAR_BUSINESS_TYPES = [
  "HVAC",
  "Plumbing",
  "Construction",
  "Landscaping",
  "Auto Repair",
  "Property Management",
  "Software Development",
  "Marketing / Advertising",
  "Accounting / Bookkeeping",
  "E-commerce",
  "Restaurant / Hospitality",
  "Professional Services",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

const BUSINESS_TYPE_ALIASES: Record<string, string[]> = {
  "Software Development": [
    "software",
    "app",
    "developer",
    "coding",
    "saas",
    "tech company",
  ],
  "Marketing / Advertising": [
    "marketing",
    "ads",
    "advertising",
    "social media",
    "seo",
  ],
  Landscaping: ["lawn", "lawn care", "yard", "landscape", "tree service"],
  "Auto Repair": ["mechanic", "garage", "car repair", "automotive"],
  "General Contracting": [
    "contractor",
    "remodel",
    "renovation",
    "home improvement",
  ],
  "Web Design / IT Services": [
    "website",
    "web agency",
    "managed it",
    "computer support",
  ],
  "Accounting / Bookkeeping": ["bookkeeper", "tax", "cpa", "accountant"],
  "Restaurant / Hospitality": [
    "restaurant",
    "cafe",
    "bar",
    "hotel",
    "catering",
  ],
  "Healthcare Practice": ["clinic", "medical", "doctor", "health practice"],
  "Trucking / Logistics": [
    "trucking",
    "freight",
    "delivery fleet",
    "transportation",
  ],
};

export function searchBusinessTypes(query: string, limit = 8) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const words = normalized
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  return BUSINESS_TYPES.map((name) => {
    const haystack = [name, ...(BUSINESS_TYPE_ALIASES[name] ?? [])]
      .join(" ")
      .toLowerCase();
    let score =
      haystack === normalized ? 100 : haystack.includes(normalized) ? 60 : 0;
    score += words.reduce(
      (total, word) => total + (haystack.includes(word) ? 8 : 0),
      0,
    );
    return { name, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.name);
}
