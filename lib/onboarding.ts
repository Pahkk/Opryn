export const ONBOARDING_STEPS = [
  "goals",
  "knowledge",
  "tools",
  "connections",
  "setup",
  "teach",
  "test",
  "invite",
  "complete",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_VIEWS = [
  ...ONBOARDING_STEPS,
  "goals_plan",
  "tools_business",
  "tools_ai",
] as const;

export type OnboardingView = (typeof ONBOARDING_VIEWS)[number];

const LEARNING_SOURCE_LABELS: Record<string, string> = {
  google_drive: "Google Drive",
  documents: "Documents",
  in_my_head: "Owner explanation",
  ai_conversations: "AI conversations",
  chatgpt: "ChatGPT",
  claude: "Claude",
  slack: "Slack",
  teams: "Microsoft Teams",
  twilio: "Calls",
  calls: "Calls",
  video: "Video / screen recording",
  voice: "Voice",
};

export function onboardingSourceLabel(source: string) {
  return (
    LEARNING_SOURCE_LABELS[source] ??
    source
      .split("_")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ")
  );
}

const INDUSTRY_AREAS: Record<string, string[]> = {
  plumbing: [
    "Customer Questions",
    "Scheduling",
    "Estimates",
    "Pricing & Discounts",
    "Warranty",
    "Vendor & Parts",
  ],
  hvac: [
    "Customer Questions",
    "Scheduling",
    "Estimates",
    "Maintenance Plans",
    "Warranty",
    "Parts & Equipment",
  ],
  construction: [
    "Estimates",
    "Project Handoffs",
    "Change Orders",
    "Safety",
    "Subcontractors",
    "Customer Updates",
  ],
  electrical: [
    "Customer Questions",
    "Scheduling",
    "Estimates",
    "Safety",
    "Inspections",
    "Parts & Materials",
  ],
  landscaping: [
    "Customer Intake",
    "Scheduling",
    "Estimates",
    "Crew Handoffs",
    "Equipment",
    "Seasonal Work",
  ],
  roofing: [
    "Inspections",
    "Estimates",
    "Scheduling",
    "Materials",
    "Safety",
    "Warranty",
  ],
  "software development": [
    "Client Onboarding",
    "Development Workflow",
    "Quality Review",
    "Releases",
    "Support",
    "Security & Access",
  ],
  "marketing / advertising": [
    "Client Onboarding",
    "Campaign Delivery",
    "Approvals",
    "Reporting",
    "Pricing",
    "Client Questions",
  ],
  "marketing agency": [
    "Client Onboarding",
    "Campaign Delivery",
    "Approvals",
    "Reporting",
    "Pricing",
    "Client Questions",
  ],
  "web design / it services": [
    "Client Intake",
    "Project Delivery",
    "Changes & Approvals",
    "Support",
    "Access & Credentials",
    "Billing",
  ],
  "accounting / bookkeeping": [
    "Client Intake",
    "Document Collection",
    "Deadlines",
    "Review & Approval",
    "Billing",
    "Client Questions",
  ],
  accounting: [
    "Client Intake",
    "Document Collection",
    "Deadlines",
    "Review & Approval",
    "Billing",
    "Client Questions",
  ],
  "auto repair": [
    "Customer Intake",
    "Estimates",
    "Parts",
    "Repair Approval",
    "Warranty",
    "Customer Updates",
  ],
  "property management": [
    "Tenant Questions",
    "Maintenance",
    "Vendors",
    "Leasing",
    "Payments",
    "Escalations",
  ],
  "trucking / logistics": [
    "Dispatch",
    "Customer Updates",
    "Driver Questions",
    "Exceptions",
    "Billing",
    "Safety",
  ],
  "e-commerce": [
    "Customer Support",
    "Returns",
    "Fulfillment",
    "Inventory",
    "Discounts",
    "Shipping Exceptions",
  ],
  "professional services": [
    "Client Intake",
    "Delivery",
    "Approvals",
    "Billing",
    "Client Questions",
    "Quality Review",
  ],
  manufacturing: [
    "Production",
    "Quality Checks",
    "Safety",
    "Inventory",
    "Equipment",
    "Exceptions",
  ],
  retail: [
    "Customer Service",
    "Returns",
    "Inventory",
    "Opening & Closing",
    "Discounts",
    "Vendor Orders",
  ],
  "restaurant / hospitality": [
    "Guest Service",
    "Opening & Closing",
    "Food Safety",
    "Ordering",
    "Reservations",
    "Escalations",
  ],
};

const INDUSTRY_FAMILIES = [
  {
    matches: [
      "electrical",
      "landscaping",
      "roofing",
      "cleaning",
      "pest control",
      "contracting",
      "painting",
      "flooring",
      "pool",
      "appliance repair",
      "home inspection",
      "restoration",
      "security systems",
    ],
    areas: [
      "Customer Questions",
      "Scheduling",
      "Estimates",
      "Job Handoffs",
      "Materials & Equipment",
      "Exceptions & Approvals",
    ],
  },
  {
    matches: [
      "law firm",
      "insurance",
      "real estate",
      "architecture",
      "engineering",
      "staffing",
      "recruiting",
      "photography",
      "creative studio",
      "consulting",
    ],
    areas: [
      "Client Intake",
      "Service Delivery",
      "Approvals",
      "Billing",
      "Client Questions",
      "Quality Review",
    ],
  },
  {
    matches: [
      "healthcare",
      "dental",
      "fitness",
      "wellness",
      "childcare",
      "education",
      "event services",
      "wholesale",
      "distribution",
      "agriculture",
      "nonprofit",
    ],
    areas: [
      "Customer Questions",
      "Daily Operations",
      "Scheduling",
      "Service Standards",
      "Exceptions",
      "Team Knowledge",
    ],
  },
] as const;

export function startingKnowledgeAreas(industry: string) {
  const key = industry.trim().toLowerCase();
  const family = INDUSTRY_FAMILIES.find((item) =>
    item.matches.some((match) => key.includes(match)),
  );
  const base = INDUSTRY_AREAS[key] ??
    family?.areas ?? [
      "Customer Questions",
      "How Work Gets Done",
      "Pricing & Approvals",
      "Scheduling",
      "Exceptions",
      "Team Knowledge",
    ];
  return base;
}

export function goalSummary(goals: string[]) {
  const labels: Record<string, string> = {
    answer_questions: "reduce repeat questions",
    train_people: "make team handoffs easier",
    capture_knowledge: "capture what currently lives in your head",
    organize_knowledge: "bring company knowledge into one reliable place",
    learn_calls: "learn useful patterns from authorized calls",
    ai_tools: "help your existing AI tools understand the business",
    owner_independence: "make the company less dependent on you",
  };
  const selected = goals.map((goal) => labels[goal]).filter(Boolean);
  if (!selected.length) return "build a useful company knowledge base";
  if (selected.length === 1) return selected[0];
  return `${selected.slice(0, -1).join(", ")}, and ${selected.at(-1)}`;
}
