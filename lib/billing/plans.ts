export type PlanId = "core" | "premium";
export type BillingInterval = "month" | "year";
export type PlanFeature =
  | "ai_conversation_learning"
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
    ai_conversation_learning: false,
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
    ai_conversation_learning: true,
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
    name: "Starter",
    monthlyPrice: 49,
  },
  premium: {
    name: "Pro",
    monthlyPrice: 129,
  },
});

/** Historical database keys remain core/premium so existing access rules and
 * subscriptions keep working. Starter/Pro are the customer-facing names. */
export const PUBLIC_PLAN_KEYS = Object.freeze({
  core: "starter",
  premium: "pro",
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
