import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { createInviteCode } from "@/lib/invite-code";
import { deliverWorkspaceInvite } from "@/lib/invitations";
import { getTeamLimit } from "@/lib/billing/plans";
import { getOrganizationPlan } from "@/lib/billing/subscription";
const schema = z.object({
  email: z.string().trim().email().max(320),
  roleId: z.string().uuid().nullable().optional(),
});
const inviteActionSchema = z.object({ inviteId: z.string().uuid() });

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid work email." },
      { status: 400 },
    );
  const organizationId = context.membership.organization_id;
  const [subscription, members, invites] = await Promise.all([
    getOrganizationPlan(context.supabase, organizationId),
    context.supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    context.supabase
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
  ]);
  const employeeSeats =
    Math.max(0, (members.count ?? 1) - 1) + (invites.count ?? 0);
  const teamLimit = getTeamLimit(subscription.plan);
  if (employeeSeats >= teamLimit)
    return NextResponse.json(
      {
        error: `${subscription.plan === "premium" ? "Premium" : "Core"} includes up to ${teamLimit} employees. Upgrade or remove a pending invite to add another teammate.`,
        code: "team_limit_reached",
      },
      { status: 402 },
    );
  if (parsed.data.roleId) {
    const { data: role } = await context.supabase
      .from("roles")
      .select("id")
      .eq("id", parsed.data.roleId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!role)
      return NextResponse.json(
        { error: "Choose a role from this workspace." },
        { status: 400 },
      );
  }
  const email = parsed.data.email.toLowerCase();
  const { data: existingProfile } = await context.supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile) {
    const { data: existingMember } = await context.supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", existingProfile.id)
      .maybeSingle();
    if (existingMember)
      return NextResponse.json(
        { error: "This person is already on your team." },
        { status: 409 },
      );
  }
  const accessCode = createInviteCode(randomBytes(8));
  const tokenHash = createHash("sha256").update(accessCode).digest("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: revokeError } = await context.supabase
    .from("organization_invites")
    .update({ status: "revoked" })
    .eq("organization_id", organizationId)
    .eq("email", email)
    .eq("status", "pending");
  if (revokeError)
    return NextResponse.json(
      { error: "Unable to replace the existing invitation." },
      { status: 400 },
    );
  const { data, error } = await context.supabase
    .from("organization_invites")
    .insert({
      organization_id: organizationId,
      email,
      role_id: parsed.data.roleId || null,
      permission_level: "employee",
      token_hash: tokenHash,
      invited_by: context.user.id,
      expires_at: expires,
    })
    .select("id,email,expires_at")
    .single();
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "An active invite already exists for this email."
            : "Unable to create the invitation.",
      },
      { status: 400 },
    );
  const inviteUrl = inviteLink(request, accessCode);
  const organizationName = await getOrganizationName(
    context.supabase,
    organizationId,
  );
  const delivery = await deliverWorkspaceInvite({
    email,
    inviteUrl,
    accessCode,
    organizationName,
  });
  return NextResponse.json({
    ...data,
    inviteUrl,
    accessCode,
    delivered: delivery.delivered,
  });
}

export async function PATCH(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = inviteActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invitation not found." },
      { status: 400 },
    );
  const organizationId = context.membership.organization_id;
  const { data: invite } = await context.supabase
    .from("organization_invites")
    .select("id,email,status")
    .eq("id", parsed.data.inviteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!invite || invite.status !== "pending")
    return NextResponse.json(
      { error: "This invitation is no longer pending." },
      { status: 404 },
    );
  const accessCode = createInviteCode(randomBytes(8));
  const tokenHash = createHash("sha256").update(accessCode).digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await context.supabase
    .from("organization_invites")
    .update({ token_hash: tokenHash, expires_at: expiresAt })
    .eq("id", invite.id)
    .eq("organization_id", organizationId);
  if (error)
    return NextResponse.json(
      { error: "Unable to renew this invitation." },
      { status: 400 },
    );
  const inviteUrl = inviteLink(request, accessCode);
  const organizationName = await getOrganizationName(
    context.supabase,
    organizationId,
  );
  const delivery = await deliverWorkspaceInvite({
    email: invite.email,
    inviteUrl,
    accessCode,
    organizationName,
  });
  return NextResponse.json({
    inviteUrl,
    accessCode,
    expiresAt,
    delivered: delivery.delivered,
  });
}

function inviteLink(request: Request, accessCode: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(
    /\/$/,
    "",
  );
  const baseUrl = configured || new URL(request.url).origin;
  return `${baseUrl}/join/${encodeURIComponent(accessCode)}`;
}

async function getOrganizationName(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();
  return data?.name || "your team";
}

export async function DELETE(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = inviteActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invitation not found." },
      { status: 400 },
    );
  const { error } = await context.supabase
    .from("organization_invites")
    .update({ status: "revoked" })
    .eq("id", parsed.data.inviteId)
    .eq("organization_id", context.membership.organization_id)
    .eq("status", "pending");
  return error
    ? NextResponse.json(
        { error: "Unable to cancel this invitation." },
        { status: 400 },
      )
    : NextResponse.json({ ok: true });
}
