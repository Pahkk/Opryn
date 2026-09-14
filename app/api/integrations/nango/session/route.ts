import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { getNangoProvider } from "@/lib/integrations/nango-providers";
import {
  ConnectionError,
  nangoEnvironment,
  nangoRequest,
} from "@/lib/integrations/nango";

export async function GET() {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const result = await createServiceClient()
    .from("integration_connect_attempts")
    .select("id,provider")
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());
  if (result.error)
    return NextResponse.json(
      { error: "Could not load pending authorizations." },
      { status: 503 },
    );
  return NextResponse.json(
    { attempts: result.data },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  let attemptId: string | undefined;
  try {
    const body = z
      .object({ provider: z.string().max(80), organizationId: z.uuid() })
      .strict()
      .parse(await request.json());
    if (body.organizationId !== context.membership.organization_id)
      return NextResponse.json(
        { error: "Your active business changed. Reopen Connections." },
        { status: 409 },
      );
    const provider = getNangoProvider(body.provider);
    const limit = await context.supabase.rpc(
      "consume_integration_auth_rate_limit",
      { target_organization_id: context.membership.organization_id },
    );
    if (limit.error || limit.data !== true)
      throw new ConnectionError("Please wait before trying again.", 429);
    const db = createServiceClient();
    const started = await db.rpc("begin_nango_connection", {
      target_org: context.membership.organization_id,
      target_user: context.user.id,
      target_provider: provider.id,
      integration_key: provider.integrationId,
      environment_name: nangoEnvironment(),
    });
    if (started.error || !started.data)
      throw new ConnectionError(
        "Authorization is already in progress, or setup is unavailable. Finish or cancel the existing attempt.",
        409,
      );
    attemptId = started.data as string;
    const attempt = await db
      .from("integration_connect_attempts")
      .select("connection_id")
      .eq("id", attemptId)
      .single();
    if (attempt.error)
      throw new ConnectionError("Could not start authorization.");
    const reconnect = attempt.data.connection_id;
    const response = await nangoRequest(
      reconnect ? "/connect/sessions/reconnect" : "/connect/sessions",
      {
        method: "POST",
        body: JSON.stringify(
          reconnect
            ? {
                connection_id: reconnect,
                integration_id: provider.integrationId,
              }
            : {
                allowed_integrations: [provider.integrationId],
                tags: {
                  organization_id: context.membership.organization_id,
                  end_user_id: context.user.id,
                  opryn_attempt_id: attemptId,
                },
              },
        ),
      },
    );
    const session = z
      .object({ data: z.object({ token: z.string(), expires_at: z.string() }) })
      .parse(await response.json());
    return NextResponse.json(
      {
        sessionToken: session.data.token,
        integrationId: provider.integrationId,
        reconnect: Boolean(reconnect),
        attemptId,
        expiresAt: session.data.expires_at,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (attemptId)
      await createServiceClient()
        .from("integration_connect_attempts")
        .update({ status: "cancelled" })
        .eq("id", attemptId)
        .eq("status", "pending");
    return NextResponse.json(
      {
        error:
          error instanceof ConnectionError
            ? error.message
            : "Could not start this connection. Please try again.",
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
