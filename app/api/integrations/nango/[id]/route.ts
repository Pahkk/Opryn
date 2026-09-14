import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ConnectionError,
  connectionPath,
  nangoEnvironment,
  nangoRequest,
} from "@/lib/integrations/nango";
import {
  driveRequest,
  requireNangoCapability,
} from "@/lib/integrations/nango-capabilities";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const result = await context.supabase
    .from("integrations")
    .select(
      "id,provider,status,external_account_name,connected_by,connected_at,capabilities,last_used_at,last_sync_at,error_code,configuration",
    )
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id)
    .eq("auth_platform", "nango")
    .maybeSingle();
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "Connection not found." },
      { status: 404 },
    );
  const actor = await context.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", result.data.connected_by)
    .maybeSingle();
  let connectedAccount = result.data.external_account_name;
  if (
    result.data.provider === "google_drive" &&
    result.data.status === "connected"
  ) {
    try {
      const connection = await requireNangoCapability(
        context.supabase,
        context.membership.organization_id,
        id,
        "knowledge_import",
      );
      const response = await driveRequest(
        connection,
        "about?fields=user(displayName,emailAddress)",
      );
      const about = z
        .object({
          user: z.object({
            displayName: z.string().optional(),
            emailAddress: z.string().email().optional(),
          }),
        })
        .parse(await response.json());
      connectedAccount =
        about.user.emailAddress ?? about.user.displayName ?? connectedAccount;
      if (
        connectedAccount &&
        connectedAccount !== result.data.external_account_name
      )
        await createServiceClient()
          .from("integrations")
          .update({ external_account_name: connectedAccount })
          .eq("id", id)
          .eq("organization_id", context.membership.organization_id);
    } catch {
      // Connection details remain useful if Google profile lookup is temporarily unavailable.
    }
  }
  const selectedFiles = z
    .object({
      selected_files: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            processId: z.string().uuid().optional(),
            importedAt: z.string().optional(),
          }),
        )
        .default([]),
    })
    .passthrough()
    .safeParse(result.data.configuration);
  return NextResponse.json(
    {
      ...result.data,
      configuration: undefined,
      external_account_name: connectedAccount,
      selected_files: selectedFiles.success
        ? selectedFiles.data.selected_files
        : [],
      connected_by_label: actor.data?.full_name || "Workspace administrator",
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { id } = await params;
  const result = await context.supabase
    .from("integrations")
    .select(
      "id,provider,provider_config_key,external_connection_id,configuration",
    )
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id)
    .eq("auth_platform", "nango")
    .maybeSingle();
  if (result.error || !result.data)
    return NextResponse.json(
      { error: "Connection not found." },
      { status: 404 },
    );
  try {
    const connection = result.data;
    if (connection.configuration?.environment !== nangoEnvironment())
      throw new ConnectionError(
        "This connection belongs to a different environment.",
        409,
      );
    const db = createServiceClient();
    // Stop Opryn access first. Keep a tombstone so delayed webhooks cannot reconnect it.
    const stopped = await db.rpc("stop_nango_connection", {
      target_org: context.membership.organization_id,
      target_user: context.user.id,
      target_id: id,
    });
    if (stopped.error || stopped.data !== true)
      throw new Error("Could not stop connection");
    try {
      await nangoRequest(
        connectionPath(
          connection.provider_config_key,
          connection.external_connection_id,
        ),
        { method: "DELETE" },
      );
    } catch (error) {
      if (!(error instanceof ConnectionError && error.status === 404))
        throw error;
    }
    const saved = await db
      .from("integrations")
      .update({ error_code: null })
      .eq("id", id)
      .eq("organization_id", context.membership.organization_id);
    if (saved.error) throw new Error("Storage unavailable");
    return NextResponse.json({ disconnected: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Disconnect could not be completed. Retry to finish removing the authorization.",
      },
      { status: 503 },
    );
  }
}
