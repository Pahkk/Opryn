import { NextResponse } from "next/server";
import { OPRYN_SITE_URL, teamsConfig } from "@/lib/communication/config";
import {
  consumeOAuthState,
  saveCommunicationIntegration,
} from "@/lib/communication/oauth";

type MicrosoftToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state") ?? "";
  const code = requestUrl.searchParams.get("code") ?? "";
  const denied = requestUrl.searchParams.get("error");
  const destination = new URL("/app/integrations/teams", OPRYN_SITE_URL);
  if (denied || !state || !code) {
    destination.searchParams.set("error", denied || "connection_cancelled");
    return NextResponse.redirect(destination);
  }
  try {
    const oauthState = await consumeOAuthState(state, "teams");
    if (!oauthState) throw new Error("The Microsoft connection link expired.");
    const config = teamsConfig();
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
          scope:
            "openid profile offline_access User.Read Organization.Read.All",
        }),
        cache: "no-store",
      },
    );
    const tokens = (await tokenResponse.json()) as MicrosoftToken;
    if (!tokenResponse.ok || !tokens.access_token)
      throw new Error(
        `Microsoft OAuth failed: ${tokens.error || tokenResponse.status}`,
      );
    const orgResponse = await fetch(
      "https://graph.microsoft.com/v1.0/organization?$select=id,displayName",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
      },
    );
    const graph = (await orgResponse.json()) as {
      value?: Array<{ id?: string; displayName?: string }>;
    };
    const tenant = graph.value?.[0];
    if (!orgResponse.ok || !tenant?.id)
      throw new Error("Microsoft tenant information was unavailable.");
    await saveCommunicationIntegration({
      organizationId: oauthState.organization_id,
      userId: oauthState.created_by,
      provider: "teams",
      workspaceId: tenant.id,
      workspaceName: tenant.displayName || "Microsoft Teams",
      credentials: {
        provider: "teams",
        tenantId: tenant.id,
        refreshToken: tokens.refresh_token,
      },
    });
    if (oauthState.return_to) {
      const returnDestination = new URL(oauthState.return_to, OPRYN_SITE_URL);
      returnDestination.searchParams.set("connected", "teams");
      return NextResponse.redirect(returnDestination);
    }
    destination.searchParams.set("connected", "1");
  } catch (error) {
    console.error("[Opryn Everywhere] Teams callback failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    destination.searchParams.set("error", "teams_connection_failed");
  }
  return NextResponse.redirect(destination);
}
