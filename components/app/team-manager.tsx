"use client";
import { StaggerList } from "@/components/motion/motion-region";
import { DialogSurface } from "@/components/app/dialog-surface";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  LoaderCircle,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { showAppToast } from "@/lib/client-toast";

type Role = {
  id: string;
  name: string;
  description: string;
  processCount: number;
};
type Member = {
  id: string;
  user_id: string;
  permission_level: string;
  role_id: string | null;
  joined_at: string;
  profile: { full_name: string | null; email: string } | null;
};
type Invite = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  role: { name: string } | null;
};

export function TeamManager({
  roles,
  members,
  invites,
  invitedCount,
  currentUserId,
  canManage,
}: {
  roles: Role[];
  members: Member[];
  invites: Invite[];
  invitedCount: number;
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    url: string;
    accessCode: string;
    delivered: boolean;
  } | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [updatingInviteId, setUpdatingInviteId] = useState<string | null>(null);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((member) => [member.id, member.role_id ?? ""]),
    ),
  );

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, roleId: roleId || null }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to create this invitation.");
      setInviteResult({
        url: body.inviteUrl,
        accessCode: body.accessCode,
        delivered: body.delivered,
      });
      showAppToast(
        body.delivered ? "Invitation emailed!" : "Secure invite created!",
        body.delivered
          ? `A sign-in link was sent to ${email}.`
          : "Email delivery was unavailable. Copy the secure link instead.",
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to invite employee.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function update(
    memberId: string,
    nextRole: string,
    permission: string,
    change: "role" | "access",
  ) {
    const previousRole = memberRoles[memberId] ?? "";
    if (change === "role")
      setMemberRoles((current) => ({ ...current, [memberId]: nextRole }));
    setUpdatingMemberId(memberId);
    setError("");
    try {
      const response = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roleId: nextRole || null,
          permissionLevel: permission,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to update this team member.");
      setMemberRoles((current) => ({
        ...current,
        [memberId]: body.member.role_id ?? "",
      }));
      showAppToast(
        change === "role" ? "Role saved!" : "Access updated!",
        change === "role"
          ? "This assignment will remain after refresh and controls their knowledge access."
          : "The new workspace access is active.",
      );
      router.refresh();
    } catch (caught) {
      if (change === "role")
        setMemberRoles((current) => ({
          ...current,
          [memberId]: previousRole,
        }));
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update this team member.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function remove(id: string) {
    if (updatingMemberId) return;
    setUpdatingMemberId(id);
    setError("");
    try {
      const check = await fetch(`/api/team/members/${id}`);
      const checked = await check.json();
      if (!check.ok) throw new Error(checked.error);
      const impact = checked.impact;
      if (impact.questions || impact.expertise || impact.connections)
        throw new Error(
          `Before removal: resolve ${impact.questions} assigned questions, reassign ${impact.expertise} expertise assignments, and disconnect or transfer ${impact.connections} connections. Workspace access has not changed.`,
        );
      if (
        !confirm(
          "Remove this person from the current workspace? No outstanding questions, expertise assignments, or active connections were found. They will lose workspace access.",
        )
      )
        return;
      const response = await fetch(`/api/team/members/${id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      showAppToast("Team member removed", "Their workspace access is closed.");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Removal could not be completed. Check your connection and retry.",
      );
    } finally {
      setUpdatingMemberId(null);
    }
  }

  async function resend(invite: Invite) {
    setUpdatingInviteId(invite.id);
    setError("");
    try {
      const response = await fetch("/api/team/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to resend invitation.");
      setInviteResult({
        url: body.inviteUrl,
        accessCode: body.accessCode,
        delivered: body.delivered,
      });
      showAppToast(
        body.delivered ? "Invitation sent again!" : "New invite link created!",
        body.delivered
          ? `A fresh sign-in link was sent to ${invite.email}.`
          : "Copy and send the fresh secure link.",
      );
      setOpen(true);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to resend invitation.",
      );
    } finally {
      setUpdatingInviteId(null);
    }
  }

  async function cancelInvite(invite: Invite) {
    if (updatingInviteId) return;
    if (!confirm(`Cancel the invitation for ${invite.email}?`)) return;
    setUpdatingInviteId(invite.id);
    setError("");
    try {
      const response = await fetch("/api/team/invites", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id }),
      });
      setUpdatingInviteId(null);
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Unable to cancel invitation.");
        return;
      }
      showAppToast(
        "Invitation canceled",
        "That secure link can no longer be used.",
      );
      router.refresh();
    } catch {
      setError(
        "The invitation could not be cancelled. Check your connection and retry.",
      );
    } finally {
      setUpdatingInviteId(null);
    }
  }

  function startInvite() {
    setEmail("");
    setRoleId("");
    setError("");
    setInviteResult(null);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#667184]">
          {members.length} active
          {canManage ? ` · ${invitedCount} invited` : ""} · {roles.length} roles
        </p>
        {canManage ? (
          <button
            data-guide="team.invite"
            onClick={startInvite}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white shadow-[0_9px_22px_rgba(49,88,216,.18)] hover:bg-[#2446b8]"
          >
            <Plus className="size-4" />
            Invite Employee
          </button>
        ) : null}
      </div>

      {error && !open ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
        >
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
        <label className="mb-5 block text-sm font-medium">
          Search members
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-[var(--opryn-line)] px-3 text-base"
            type="search"
            placeholder="Name, email, or access role"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#718095]">
              Your team
            </p>
            <h2 className="mt-1 text-lg font-semibold">People and roles</h2>
          </div>
          <span className="rounded-full bg-[#f1f4f8] px-3 py-1 text-xs font-semibold text-[#627086]">
            {members.length} active
          </span>
        </div>
        <StaggerList
          className="mt-5 divide-y divide-[var(--opryn-line)]"
          changeKey={`${query}:${members.map((member) => `${member.id}:${member.role_id}:${member.permission_level}`).join("|")}`}
        >
          {members
            .filter((member) =>
              `${memberName(member)} ${member.profile?.email} ${member.permission_level}`
                .toLowerCase()
                .includes(query.trim().toLowerCase()),
            )
            .map((member) => {
              const name = memberName(member);
              const isOwner = member.permission_level === "owner";
              return (
                <article
                  key={member.id}
                  className="py-5"
                  data-motion-row={member.id}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="truncate text-xs text-[#7b8798]">
                        {member.profile?.email}
                      </p>
                    </div>
                    {canManage &&
                    member.permission_level !== "owner" &&
                    member.user_id !== currentUserId ? (
                      <button
                        disabled={Boolean(updatingMemberId)}
                        onClick={() => void remove(member.id)}
                        aria-label={`Remove ${name}`}
                        className="grid size-11 place-items-center rounded-lg text-[#9a5960] hover:bg-[#fff0f1] disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7b8798]">
                        Job role
                        <select
                          aria-label={`Assigned role for ${name}`}
                          disabled={isOwner || updatingMemberId === member.id}
                          value={memberRoles[member.id] ?? ""}
                          onChange={(event) =>
                            void update(
                              member.id,
                              event.target.value,
                              member.permission_level,
                              "role",
                            )
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-[#cfd8e4] bg-white px-2.5 text-xs font-medium normal-case tracking-normal disabled:bg-[#f5f6f8] disabled:text-[#8993a2]"
                        >
                          <option value="">
                            {isOwner ? "Workspace owner" : "Assign a role…"}
                          </option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7b8798]">
                        Access
                        <select
                          disabled={isOwner || member.user_id === currentUserId}
                          value={isOwner ? "owner" : member.permission_level}
                          onChange={(event) =>
                            void update(
                              member.id,
                              memberRoles[member.id] ?? "",
                              event.target.value,
                              "access",
                            )
                          }
                          className="mt-1 h-10 w-full rounded-lg border border-[#cfd8e4] bg-white px-2.5 text-xs font-medium capitalize normal-case tracking-normal disabled:bg-[#f5f6f8]"
                        >
                          <option value="owner" disabled>
                            Owner
                          </option>
                          <option value="admin">Admin</option>
                          <option value="employee">Employee</option>
                        </select>
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-[#f7f9fc] px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7b8798]">
                          Job role
                        </p>
                        <p className="mt-1 font-medium text-[#344054]">
                          {isOwner
                            ? "Workspace owner"
                            : (roles.find((role) => role.id === member.role_id)
                                ?.name ?? "Team member")}
                        </p>
                      </div>
                      <div className="rounded-lg bg-[#f7f9fc] px-3 py-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#7b8798]">
                          Access
                        </p>
                        <p className="mt-1 font-medium capitalize text-[#344054]">
                          {member.permission_level}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          {members.length > 0 &&
          !members.some((member) =>
            `${memberName(member)} ${member.profile?.email} ${member.permission_level}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
          ) ? (
            <p className="py-6 text-sm text-[var(--opryn-muted)]">
              No team members match this search.
            </p>
          ) : null}
        </StaggerList>
      </section>

      {canManage && invites.length ? (
        <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-[#3158d8]" />
            <h2 className="font-semibold">Pending invitations</h2>
          </div>
          <StaggerList
            className="mt-4 divide-y divide-[#edf0f4]"
            changeKey={invites.map((invite) => invite.id).join("|")}
          >
            {invites.map((invite) => (
              <div
                key={invite.id}
                data-motion-row={invite.id}
                className="flex flex-col gap-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="mt-1 text-xs text-[#7b8798]">
                    {invite.role?.name ?? "Role not assigned"} · Expires{" "}
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={updatingInviteId === invite.id}
                    onClick={() => void resend(invite)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d8dfe8] px-3 text-xs font-semibold text-[#53627a] disabled:opacity-60"
                  >
                    {updatingInviteId === invite.id ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Resend
                  </button>
                  <button
                    disabled={updatingInviteId === invite.id}
                    onClick={() => void cancelInvite(invite)}
                    className="min-h-9 rounded-lg px-3 text-xs font-semibold text-[#9a5960] hover:bg-[#fff0f1]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </StaggerList>
        </section>
      ) : null}

      {canManage && open ? (
        <DialogSurface
          label="Invite an employee"
          busy={loading}
          onClose={() => setOpen(false)}
        >
          <form
            onSubmit={invite}
            className="dialog-content mobile-sheet-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.1em] text-[#3158d8]">
                  Team invitation
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Invite an employee
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg hover:bg-[#f2f4f7]"
              >
                <X className="size-4" />
              </button>
            </div>
            {inviteResult ? (
              <div className="mt-6">
                <div className="flex items-start gap-2 rounded-xl bg-[#eaf7f1] p-3 text-sm text-[#177257]">
                  <Check className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {inviteResult.delivered
                      ? "Invitation emailed. The employee can use the secure sign-in link to join."
                      : "The invitation is ready, but email delivery was unavailable."}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#657286]">
                  Send the Opryn link or give them the access code. Both expire
                  in seven days and only work for the invited email.
                </p>
                <div className="mt-4 border-y border-[#e2e7ed] py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a95a5]">
                    Access code
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="font-mono text-base font-semibold tracking-[.08em] text-[#0e2f78]">
                      {inviteResult.accessCode}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          inviteResult.accessCode,
                        );
                        showAppToast(
                          "Access code copied!",
                          "The employee can enter it during onboarding.",
                        );
                      }}
                      className="text-xs font-semibold text-[#163f98]"
                    >
                      Copy code
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteResult.url);
                    showAppToast("Invite link copied!", "It is ready to send.");
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5dce6] px-3 py-3 text-sm font-semibold"
                >
                  <Copy className="size-4" />
                  Copy invite link
                </button>
                <button
                  type="button"
                  onClick={startInvite}
                  className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-[#3158d8]"
                >
                  Invite another person
                </button>
              </div>
            ) : (
              <>
                <label className="mt-6 block text-sm font-medium">
                  Work email
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5 outline-none focus:border-[#7190ee] focus:ring-4 focus:ring-[#3158d8]/10"
                  />
                </label>
                <label className="mt-4 block text-sm font-medium">
                  Role
                  <select
                    value={roleId}
                    onChange={(event) => setRoleId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5"
                  >
                    <option value="">Assign later</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                {error ? (
                  <p role="alert" className="mt-3 text-sm text-[#a83f49]">
                    {error}
                  </p>
                ) : null}
                <button
                  disabled={loading}
                  className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3158d8] text-sm font-semibold text-white disabled:opacity-60"
                >
                  {loading ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {loading ? "Sending…" : "Send Invitation"}
                </button>
              </>
            )}
          </form>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-xl bg-[#edf2ff] font-bold text-[#3158d8] ${small ? "size-7 text-[9px]" : "size-10 text-xs"}`}
    >
      {name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

function memberName(member: Member) {
  return member.profile?.full_name ?? member.profile?.email ?? "Team member";
}
