import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";

const updateSchema = z.object({
  provider: z.enum(["slack", "teams"]),
  status: z.enum(["active", "paused"]).optional(),
  accessMode: z
    .enum(["all_members", "selected_roles", "selected_users"])
    .optional(),
  roleIds: z.array(z.string().uuid()).max(50).optional(),
  userIds: z.array(z.string().uuid()).max(100).optional(),
  escalationDestination: z.enum(["opryn", "slack", "teams"]).optional(),
});

export async function PATCH(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check these settings and try again." },
      { status: 400 },
    );
  const service = createServiceClient();
  const organizationId = context.membership.organization_id;
  const { data: existing } = await service
    .from("communication_integrations")
    .select("id,settings")
    .eq("organization_id", organizationId)
    .eq("provider", parsed.data.provider)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "This connection was not found." },
      { status: 404 },
    );
  const previous =
    existing.settings && typeof existing.settings === "object"
      ? (existing.settings as Record<string, unknown>)
      : {};
  if (parsed.data.roleIds) {
    const { data: allowedRoles } = await service
      .from("roles")
      .select("id")
      .eq("organization_id", organizationId)
      .in("id", parsed.data.roleIds);
    if ((allowedRoles?.length ?? 0) !== parsed.data.roleIds.length)
      return NextResponse.json(
        { error: "One of those roles is not available." },
        { status: 400 },
      );
  }
  if (parsed.data.userIds) {
    const { data: allowedUsers } = await service
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .in("user_id", parsed.data.userIds);
    if ((allowedUsers?.length ?? 0) !== parsed.data.userIds.length)
      return NextResponse.json(
        { error: "One of those team members is not available." },
        { status: 400 },
      );
  }
  const settings = {
    ...previous,
    access_mode:
      parsed.data.accessMode ?? previous.access_mode ?? "all_members",
    role_ids: parsed.data.roleIds ?? previous.role_ids ?? [],
    user_ids: parsed.data.userIds ?? previous.user_ids ?? [],
    escalation_destination:
      parsed.data.escalationDestination ??
      previous.escalation_destination ??
      "opryn",
  };
  const { error } = await service
    .from("communication_integrations")
    .update({
      settings,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    })
    .eq("id", existing.id)
    .eq("organization_id", organizationId);
  if (error)
    return NextResponse.json(
      { error: "Opryn couldn't save these settings." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const provider = new URL(request.url).searchParams.get("provider");
  if (provider !== "slack" && provider !== "teams")
    return NextResponse.json({ error: "Unknown connection." }, { status: 400 });
  const { error } = await createServiceClient()
    .from("communication_integrations")
    .update({
      status: "disconnected",
      encrypted_credentials: null,
      bot_user_id: null,
    })
    .eq("organization_id", context.membership.organization_id)
    .eq("provider", provider);
  if (error)
    return NextResponse.json(
      { error: "Opryn couldn't disconnect this integration." },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
