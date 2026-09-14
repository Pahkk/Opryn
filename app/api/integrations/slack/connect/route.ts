import { NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api";
import { requireFeature } from "@/lib/billing/subscription";
import { OPRYN_SITE_URL, slackConfig } from "@/lib/communication/config";
import { createOAuthState } from "@/lib/communication/oauth";

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    await requireFeature(
      context.supabase,
      context.membership.organization_id,
      "slackIntegration",
    );
    const config = slackConfig();
    const state = await createOAuthState({
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      provider: "slack",
      returnTo: new URL(request.url).searchParams.get("returnTo") ?? undefined,
    });
    const url = new URL("https://slack.com/oauth/v2/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set(
      "scope",
      "app_mentions:read,chat:write,commands,im:history",
    );
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured"))
      return NextResponse.redirect(
        `${OPRYN_SITE_URL}/app/integrations/slack?error=not_configured`,
      );
    return apiError(error, "Opryn couldn't start the Slack connection.");
  }
}
