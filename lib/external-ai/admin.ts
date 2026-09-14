import "server-only";

import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import {
  FeatureUnavailableError,
  requireFeature,
} from "@/lib/billing/subscription";

export async function getExternalAIAdminContext() {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context;
  try {
    await requireFeature(
      context.supabase,
      context.membership.organization_id,
      "aiConnections",
    );
    return context;
  } catch (error) {
    if (error instanceof FeatureUnavailableError)
      return {
        error: NextResponse.json(
          { error: error.message, code: "premium_required" },
          { status: 403 },
        ),
      } as const;
    throw error;
  }
}
