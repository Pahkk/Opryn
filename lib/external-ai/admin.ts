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

/** Assignment authorization is enforced on the exact escalation by its route and RPC. */
export async function getExternalAIAnswerContext() {
  const context = await getRequestContext();
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
        error: NextResponse.json({ error: error.message }, { status: 403 }),
      } as const;
    throw error;
  }
}
