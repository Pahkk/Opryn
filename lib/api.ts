import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function getRequestContext({
  admin = false,
  allowBillingSetup = false,
}: { admin?: boolean; allowBillingSetup?: boolean } = {}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return {
      error: NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 },
      ),
    } as const;
  const organizationId = await import("next/headers").then(
    async ({ cookies }) => (await cookies()).get("opryn-organization")?.value,
  );
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("id, organization_id, permission_level, role_id")
    .eq("user_id", userData.user.id);
  const membership =
    memberships?.find((item) => item.organization_id === organizationId) ??
    memberships?.[0];
  if (!membership)
    return {
      error: NextResponse.json(
        { error: "Workspace access was not found." },
        { status: 403 },
      ),
    } as const;
  const expectedOrganization = await import("next/headers").then(
    async ({ headers }) => (await headers()).get("x-opryn-organization"),
  );
  if (
    expectedOrganization &&
    expectedOrganization !== membership.organization_id
  )
    return {
      error: NextResponse.json(
        { error: "Your active workspace changed. Reload before continuing." },
        { status: 409 },
      ),
    } as const;
  if (admin && !["owner", "admin"].includes(membership.permission_level))
    return {
      error: NextResponse.json(
        { error: "Owner or admin access is required." },
        { status: 403 },
      ),
    } as const;
  if (!allowBillingSetup) {
    try {
      const { billingBoundary } = await import("@/lib/billing/access");
      if (await billingBoundary(supabase, membership.organization_id))
        return {
          error: NextResponse.json(
            {
              error:
                "Choose or manage your workspace plan to continue. Your knowledge is saved.",
              code: "billing_required",
            },
            { status: 402 },
          ),
        } as const;
    } catch {
      return {
        error: NextResponse.json(
          { error: "Workspace access could not be confirmed. Please retry." },
          { status: 503 },
        ),
      } as const;
    }
  }
  return { supabase, user: userData.user, membership } as const;
}

export function apiError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  console.error(
    "Opryn API error",
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: "Unknown error" },
  );
  return NextResponse.json(
    {
      error:
        error instanceof Error && error.message.includes("not configured")
          ? error.message
          : fallback,
    },
    { status: 500 },
  );
}
