import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { rejectCrossOrigin } from "@/lib/request-origin";
import { z } from "zod";
import { cookies } from "next/headers";
import { cleanupWorkspace } from "@/lib/workspace-deletion";

export const maxDuration = 300;

/** Old tabs cannot silently overwrite the revision-aware Settings forms. */
export async function PATCH(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  return NextResponse.json(
    {
      error:
        "Settings has been updated. Reload this page before saving your changes.",
    },
    { status: 409 },
  );
}

/** The database RPC independently checks ownership, recent auth and cleanup. */
export async function DELETE(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  if (context.membership.permission_level !== "owner")
    return NextResponse.json(
      { error: "Only the workspace owner can request deletion." },
      { status: 403 },
    );
  const body = await request.text();
  if (body.length > 4096)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return NextResponse.json(
      { error: "Confirm the workspace name." },
      { status: 400 },
    );
  }
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      confirmation: z.string().min(1).max(200),
      acknowledged: z.literal(true),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Confirm the workspace name and deletion warning." },
      { status: 400 },
    );
  if (parsed.data.organizationId !== context.membership.organization_id)
    return NextResponse.json(
      { error: "Your active workspace changed. Reload before deleting." },
      { status: 409 },
    );
  const authorization = await context.supabase.rpc(
    "authorize_workspace_deletion",
    {
      workspace_id: context.membership.organization_id,
      confirmation: parsed.data.confirmation,
    },
  );
  let result = authorization;
  if (!authorization.error) {
    try {
      await cleanupWorkspace(
        context.membership.organization_id,
        context.user.id,
      );
    } catch {
      console.error("Workspace deletion cleanup needs retry");
      return NextResponse.json(
        {
          error:
            "Cleanup could not finish. Some connections, files or billing may already be removed. Retry deletion to continue safely.",
        },
        { status: 503 },
      );
    }
    result = await context.supabase.rpc("delete_workspace_safely", {
      workspace_id: context.membership.organization_id,
      confirmation: parsed.data.confirmation,
    });
  }
  if (result.error) {
    const messages: Record<string, string> = {
      "42501": "Only the workspace owner can delete this workspace.",
      "22023":
        "The workspace name changed or does not match. Reload and confirm it again.",
      P0002:
        "For safety, sign out and sign back in, then return here within 10 minutes.",
      P0003: "Billing changed during cleanup. Retry deletion to finish.",
      P0004: "A connection changed during cleanup. Retry deletion to finish.",
      P0005:
        "More workspace files remain. Retry deletion to finish removing them.",
      "55P03":
        "Workspace activity is in progress. Nothing was deleted. Try again shortly.",
    };
    return NextResponse.json(
      {
        error:
          messages[result.error.code] ||
          "Deletion could not be completed. Cleanup may already have started. Retry to finish.",
      },
      { status: result.error.code === "42501" ? 403 : 409 },
    );
  }
  const jar = await cookies();
  if (
    jar.get("opryn-organization")?.value === context.membership.organization_id
  )
    jar.delete("opryn-organization");
  return NextResponse.json({ deleted: true });
}
