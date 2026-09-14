import { NextResponse } from "next/server";
import { slackConfig, OPRYN_SITE_URL } from "@/lib/communication/config";
import {
  consumeOAuthState,
  saveCommunicationIntegration,
} from "@/lib/communication/oauth";

type SlackOAuthResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: { id?: string; name?: string };
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state") ?? "";
  const code = requestUrl.searchParams.get("code") ?? "";
  const denied = requestUrl.searchParams.get("error");
  const destination = new URL("/app/integrations/slack", OPRYN_SITE_URL);
  if (denied || !state || !code) {
    destination.searchParams.set("error", denied || "connection_cancelled");
    return NextResponse.redirect(destination);
  }
  try {
    const oauthState = await consumeOAuthState(state, "slack");
    if (!oauthState) throw new Error("The Slack connection link expired.");
    const config = slackConfig();
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    const result = (await response.json()) as SlackOAuthResponse;
    if (!response.ok || !result.ok || !result.access_token || !result.team?.id)
      throw new Error(`Slack OAuth failed: ${result.error || response.status}`);
    await saveCommunicationIntegration({
      organizationId: oauthState.organization_id,
      userId: oauthState.created_by,
      provider: "slack",
      workspaceId: result.team.id,
      workspaceName: result.team.name || "Slack workspace",
      botUserId: result.bot_user_id,
      credentials: { provider: "slack", botToken: result.access_token },
    });
    if (oauthState.return_to) {
      const returnDestination = new URL(oauthState.return_to, OPRYN_SITE_URL);
      returnDestination.searchParams.set("connected", "slack");
      return NextResponse.redirect(returnDestination);
    }
    destination.searchParams.set("connected", "1");
  } catch (error) {
    console.error("[Opryn Everywhere] Slack callback failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    destination.searchParams.set("error", "slack_connection_failed");
  }
  return NextResponse.redirect(destination);
}
