import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { getNangoProvider } from "@/lib/integrations/nango-providers";
import { ConnectionError, readNangoConnection } from "@/lib/integrations/nango";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const { data, error } = await createServiceClient()
    .from("integration_connect_attempts")
    .select("status,expires_at,provider")
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json(
      { error: "Connection attempt not found." },
      { status: 404 },
    );
  const connection =
    data.status === "confirmed"
      ? await createServiceClient()
          .from("integrations")
          .select("id")
          .eq("organization_id", context.membership.organization_id)
          .eq("provider", data.provider)
          .eq("auth_platform", "nango")
          .maybeSingle()
      : null;
  return NextResponse.json(
    {
      ...data,
      connectionId: connection?.data?.id ?? null,
      status:
        data.status === "pending" && Date.parse(data.expires_at) <= Date.now()
          ? "expired"
          : data.status,
    },
    { headers: { "Cache-Control": "no-store" } },
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
  const result = await createServiceClient()
    .from("integration_connect_attempts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .eq("status", "pending")
    .select("id");
  if (result.error)
    return NextResponse.json(
      { error: "Could not cancel authorization." },
      { status: 503 },
    );
  return NextResponse.json({ cancelled: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

  try {
    const body = z
      .object({
        connectionId: z.string().min(1).max(255),
        providerConfigKey: z.string().min(1).max(255),
      })
      .strict()
      .parse(await request.json());
    const { id } = await params;
    const db = createServiceClient();
    const attemptResult = await db
      .from("integration_connect_attempts")
      .select(
        "id,organization_id,user_id,provider,integration_key,connection_id,status,expires_at",
      )
      .eq("id", id)
      .eq("organization_id", context.membership.organization_id)
      .eq("user_id", context.user.id)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();
    if (attemptResult.error || !attemptResult.data)
      return NextResponse.json(
        { error: "Connection attempt not found." },
        { status: 404 },
      );

    const attempt = attemptResult.data;
    if (
      attempt.status === "pending" &&
      Date.parse(attempt.expires_at) <= Date.now()
    )
      return NextResponse.json(
        { error: "This authorization attempt expired." },
        { status: 409 },
      );

    const provider = getNangoProvider(attempt.provider);
    if (
      provider.integrationId !== attempt.integration_key ||
      provider.integrationId !== body.providerConfigKey
    )
      return NextResponse.json(
        { error: "Connection details did not match." },
        { status: 409 },
      );

    const remote = await readNangoConnection(
      body.providerConfigKey,
      body.connectionId,
    );
    const reconnect = Boolean(attempt.connection_id);
    if (
      remote.connection_id !== body.connectionId ||
      remote.provider_config_key !== body.providerConfigKey ||
      remote.tags.organization_id !== attempt.organization_id ||
      (reconnect
        ? attempt.connection_id !== body.connectionId
        : remote.tags.end_user_id !== attempt.user_id ||
          remote.tags.opryn_attempt_id !== attempt.id)
    )
      return NextResponse.json(
        { error: "Connection ownership could not be verified." },
        { status: 409 },
      );

    const saved = await db.rpc("confirm_nango_connection", {
      attempt_id: attempt.id,
      remote_connection_id: body.connectionId,
      target_status: remote.errors.some((error) => error.type === "auth")
        ? "needs_reauthorization"
        : "connected",
      event_operation: reconnect ? "override" : "creation",
      granted_capabilities: provider.capabilities,
    });
    if (saved.error || !saved.data)
      throw new ConnectionError("Connection confirmation failed.");

    return NextResponse.json(
      { connectionId: saved.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid connection details."
            : error instanceof ConnectionError
              ? error.message
              : "Connection confirmation failed.",
      },
      {
        status:
          error instanceof z.ZodError
            ? 400
            : error instanceof ConnectionError
              ? error.status
              : 503,
      },
    );
  }
}
