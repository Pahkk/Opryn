import { NextResponse } from "next/server";
import { getRequestContext, apiError } from "@/lib/api";
import { requireFeature } from "@/lib/billing/subscription";
import { OPRYN_SITE_URL, teamsConfig } from "@/lib/communication/config";
import { createOAuthState } from "@/lib/communication/oauth";

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    await requireFeature(
      context.supabase,
      context.membership.organization_id,
      "teamsIntegration",
    );
    const config = teamsConfig();
    const state = await createOAuthState({
      organizationId: context.membership.organization_id,
      userId: context.user.id,
      provider: "teams",
      returnTo: new URL(request.url).searchParams.get("returnTo") ?? undefined,
    });
    const url = new URL(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`,
    );
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_mode", "query");
    url.searchParams.set(
      "scope",
      "openid profile offline_access User.Read Organization.Read.All",
    );
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured"))
      return NextResponse.redirect(
        `${OPRYN_SITE_URL}/app/integrations/teams?error=not_configured`,
      );
    return apiError(
      error,
      "Opryn couldn't start the Microsoft Teams connection.",
    );
  }
}
