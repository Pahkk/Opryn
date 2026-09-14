import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getNangoProvider } from "@/lib/integrations/nango-providers";
import {
  ConnectionError,
  connectionPath,
  nangoRequest,
  nangoAuthEventSchema,
  nangoEnvironment,
  readNangoConnection,
  verifyNangoWebhook,
} from "@/lib/integrations/nango";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const key = process.env.NANGO_WEBHOOK_SECRET;
  if (!key) return new NextResponse(null, { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 64_000) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!verifyNangoWebhook(raw, request.headers.get("x-nango-hmac-sha256"), key))
    return new NextResponse(null, { status: 401 });
  try {
    const event = nangoAuthEventSchema.safeParse(JSON.parse(raw));
    if (!event.success) return NextResponse.json({ ignored: true });
    const e = event.data;
    if (e.environment !== nangoEnvironment())
      return NextResponse.json({ ignored: true });
    if (
      e.operation === "creation" &&
      !z.uuid().safeParse(e.tags.opryn_attempt_id).success
    )
      return NextResponse.json({ ignored: true });
    const db = createServiceClient();
    // Reauth preserves original tags; resolve the newest pending attempt by existing remote ID.
    let query = db
      .from("integration_connect_attempts")
      .select(
        "id,organization_id,user_id,provider,integration_key,environment,status,expires_at",
      )
      .eq("integration_key", e.providerConfigKey)
      .eq("environment", e.environment);
    query =
      e.operation === "creation"
        ? query.eq(
            "id",
            e.tags.opryn_attempt_id ?? "00000000-0000-0000-0000-000000000000",
          )
        : query
            .eq("connection_id", e.connectionId)
            .in(
              "status",
              e.operation === "override" && e.success
                ? ["pending", "confirmed"]
                : ["confirmed"],
            );
    const { data: attempt, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Storage unavailable");
    if (!attempt) {
      if (
        e.success &&
        e.operation !== "deletion" &&
        z.uuid().safeParse(e.tags.organization_id).success
      ) {
        const deleted = await db
          .from("deleted_workspaces")
          .select("organization_id")
          .eq("organization_id", e.tags.organization_id)
          .maybeSingle();
        if (deleted.error) throw new Error("Storage unavailable");
        if (deleted.data) {
          try {
            const remote = await readNangoConnection(
              e.providerConfigKey,
              e.connectionId,
            );
            if (remote.tags.organization_id === e.tags.organization_id)
              await nangoRequest(
                connectionPath(e.providerConfigKey, e.connectionId),
                { method: "DELETE" },
              );
          } catch (error) {
            if (!(error instanceof ConnectionError && error.status === 404))
              throw error;
          }
        }
      }
      return NextResponse.json({ ignored: true });
    }
    const provider = getNangoProvider(attempt.provider);
    if (
      provider.integrationId !== e.providerConfigKey ||
      attempt.organization_id !== e.tags.organization_id
    )
      return NextResponse.json({ ignored: true });
    if (e.operation === "creation" && !e.success) {
      const failed = await db
        .from("integration_connect_attempts")
        .update({ status: "cancelled" })
        .eq("id", attempt.id)
        .eq("status", "pending");
      if (failed.error)
        throw new Error("Could not record failed authorization");
      return NextResponse.json({ received: true });
    }
    let status = "disconnected";
    try {
      const remote = await readNangoConnection(
        e.providerConfigKey,
        e.connectionId,
      );
      if (
        remote.connection_id !== e.connectionId ||
        remote.provider_config_key !== e.providerConfigKey ||
        remote.tags.organization_id !== attempt.organization_id
      )
        return NextResponse.json({ ignored: true });
      if (
        e.operation === "creation" &&
        (remote.tags.opryn_attempt_id !== attempt.id ||
          remote.tags.end_user_id !== attempt.user_id)
      )
        return NextResponse.json({ ignored: true });
      if (
        ["cancelled", "expired"].includes(attempt.status) ||
        (attempt.status === "pending" &&
          Date.parse(attempt.expires_at) < Date.now())
      ) {
        if (e.operation === "creation")
          await nangoRequest(
            connectionPath(e.providerConfigKey, e.connectionId),
            { method: "DELETE" },
          );
        return NextResponse.json({ ignored: true });
      }
      status = remote.errors.some((error) => error.type === "auth")
        ? "needs_reauthorization"
        : "connected";
    } catch (error) {
      if (
        error instanceof ConnectionError &&
        error.status === 424 &&
        e.operation !== "creation"
      )
        status = "needs_reauthorization";
      else if (!(
        error instanceof ConnectionError &&
        error.status === 404 &&
        e.operation === "deletion"
      ))
        throw error;
    }
    const saved = await db.rpc("confirm_nango_connection", {
      attempt_id: attempt.id,
      remote_connection_id: e.connectionId,
      target_status: status,
      event_operation: e.operation,
      granted_capabilities: provider.capabilities,
    });
    if (saved.error) throw new Error("Reconciliation failed");
    return NextResponse.json({ received: true });
  } catch {
    // Deliberately omit payloads and SDK errors, which can carry secrets.
    console.error("Nango webhook reconciliation failed");
    return new NextResponse(null, { status: 503 });
  }
}
