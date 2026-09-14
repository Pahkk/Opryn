import { searchBusinessTypes } from "@/lib/onboarding-catalog";
/** Normalized industries above the existing granular business-type catalog.
 * Legacy names remain valid; their aliases participate in this same search. */
export const industries = [
  {
    id: "technology",
    displayName: "Software & Technology",
    keywords:
      "software technology apps app saas developer websites automation ai digital",
  },
  {
    id: "professional_services",
    displayName: "Professional Services",
    keywords:
      "consulting consultant agency automation legal law accounting accountant business services",
  },
  {
    id: "marketing",
    displayName: "Marketing & Creative Services",
    keywords:
      "marketing advertising design creative seo branding automation agency",
  },
  {
    id: "construction",
    displayName: "Construction & Trades",
    keywords:
      "construction roofing contractor hvac heating cooling plumbing electrician building renovation",
  },
  {
    id: "automotive",
    displayName: "Automotive Services",
    keywords:
      "automotive car auto detailing vehicle mechanic repair dealership",
  },
  {
    id: "local_services",
    displayName: "Local & Home Services",
    keywords:
      "local mobile cleaning detailing landscaping home maintenance lawn",
  },
  {
    id: "hospitality",
    displayName: "Restaurants & Hospitality",
    keywords:
      "restaurant restaurants food cafe catering hotel hospitality chain dining",
  },
  {
    id: "logistics",
    displayName: "Transport & Logistics",
    keywords:
      "trucking truck freight transport shipping delivery warehouse logistics",
  },
  {
    id: "retail",
    displayName: "Retail & E-commerce",
    keywords: "retail ecommerce e-commerce shop store online products consumer",
  },
  {
    id: "healthcare",
    displayName: "Healthcare & Wellness",
    keywords:
      "healthcare medical clinic dental dentist wellness fitness therapy care",
  },
  {
    id: "education",
    displayName: "Education & Training",
    keywords: "education school teaching training courses tutoring learning",
  },
  {
    id: "real_estate",
    displayName: "Real Estate & Property",
    keywords: "real estate property rental realtor housing management",
  },
  {
    id: "manufacturing",
    displayName: "Manufacturing & Industrial",
    keywords: "manufacturing factory industrial production equipment machinery",
  },
  {
    id: "finance",
    displayName: "Financial Services",
    keywords: "finance financial insurance banking investment mortgage",
  },
  {
    id: "nonprofit",
    displayName: "Nonprofit & Community",
    keywords: "nonprofit charity community association foundation",
  },
  { id: "other", displayName: "Other", keywords: "other custom" },
] as const;
export type IndustryId = (typeof industries)[number]["id"];
export const industryIds = industries.map((i) => i.id) as [
  IndustryId,
  ...IndustryId[],
];
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function searchIndustries(query: string) {
  const legacyMatches = searchBusinessTypes(query, 3).join(" ").toLowerCase();
  const words = normalize(query)
    .split(" ")
    .filter((w) => w.length > 2);
  if (!words.length) return industries.slice(0, 5);
  return industries
    .map((industry) => {
      const tokens = normalize(
        `${industry.displayName} ${industry.keywords}`,
      ).split(" ");
      const score = words.reduce(
        (sum, word) =>
          sum +
          (tokens.includes(word)
            ? 4
            : tokens.some((t) => t.startsWith(word) || word.startsWith(t))
              ? 1
              : 0),
        0,
      );
      const aliasScore = tokens.filter(
        (t) => t.length > 3 && legacyMatches.includes(t),
      ).length;
      return { industry, score: score + aliasScore };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.industry);
}
