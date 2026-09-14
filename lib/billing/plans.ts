export type PlanId = "core" | "premium";
export type BillingInterval = "month" | "year";
export type PlanFeature =
  | "videoLearning"
  | "screenRecording"
  | "callLearning"
  | "aiConnections"
  | "mcpAccess"
  | "slackIntegration"
  | "teamsIntegration"
  | "advancedAnalytics"
  | "priorityProcessing";

export const PLAN_FEATURES = Object.freeze({
  core: Object.freeze({
    videoLearning: false,
    screenRecording: false,
    callLearning: false,
    aiConnections: true,
    mcpAccess: false,
    slackIntegration: true,
    teamsIntegration: true,
    advancedAnalytics: false,
    priorityProcessing: false,
    teamLimit: 5,
  }),
  premium: Object.freeze({
    videoLearning: true,
    screenRecording: true,
    callLearning: true,
    aiConnections: true,
    mcpAccess: true,
    slackIntegration: true,
    teamsIntegration: true,
    advancedAnalytics: true,
    priorityProcessing: true,
    teamLimit: 20,
  }),
});

export const PLAN_DETAILS = Object.freeze({
  core: {
    name: "Opryn Core",
    monthlyPrice: 99,
    annualMonthlyEquivalent: 79,
  },
  premium: {
    name: "Opryn Premium",
    monthlyPrice: 249,
    annualMonthlyEquivalent: 199,
  },
});

export function hasFeature(plan: PlanId, feature: PlanFeature) {
  return PLAN_FEATURES[plan][feature];
}

export function getTeamLimit(plan: PlanId) {
  return PLAN_FEATURES[plan].teamLimit;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "core" || value === "premium";
}
