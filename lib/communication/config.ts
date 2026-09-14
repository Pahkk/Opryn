import "server-only";

export const OPRYN_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.opryn.app"
).replace(/\/$/, "");

export function slackConfig() {
  const clientId = process.env.SLACK_CLIENT_ID?.trim();
  const clientSecret = process.env.SLACK_CLIENT_SECRET?.trim();
  const signingSecret = process.env.SLACK_SIGNING_SECRET?.trim();
  const redirectUri =
    process.env.SLACK_REDIRECT_URI?.trim() ||
    `${OPRYN_SITE_URL}/api/integrations/slack/callback`;
  if (!clientId || !clientSecret || !signingSecret)
    throw new Error("Slack integration is not configured.");
  return { clientId, clientSecret, signingSecret, redirectUri };
}

export function teamsConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI?.trim() ||
    `${OPRYN_SITE_URL}/api/integrations/teams/callback`;
  if (!clientId || !clientSecret)
    throw new Error("Microsoft Teams integration is not configured.");
  return { clientId, clientSecret, tenantId, redirectUri };
}
