import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import { TeamManager } from "@/components/app/team-manager";
import { KnowledgeExperts } from "@/components/app/knowledge-experts";
import { WorkspaceNotice } from "@/components/app/workspace-context";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
export default async function TeamPage() {
  const context = await requireAppContext();
  const supabase = await createClient();
  const [
    { data: roles, error: rolesError },
    { data: members, error: membersError },
    { data: invites, error: invitesError },
    { data: processAssignments, error: assignmentsError },
    { count: invitedCount, error: inviteCountError },
    { data: experts, error: expertsError },
  ] = await Promise.all([
    supabase
      .from("roles")
      .select("id,name,description")
      .eq("organization_id", context.organization.id)
      .order("name"),
    supabase
      .from("organization_members")
      .select(
        "id,user_id,permission_level,role_id,joined_at,profiles!organization_members_user_id_fkey(full_name,email)",
      )
      .eq("organization_id", context.organization.id)
      .order("joined_at"),
    supabase
      .from("organization_invites")
      .select("id,email,status,expires_at,role_id")
      .eq("organization_id", context.organization.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("process_role_assignments")
      .select("role_id")
      .eq("organization_id", context.organization.id),
    supabase
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organization.id)
      .neq("status", "revoked"),
    context.isAdmin
      ? supabase
          .from("knowledge_experts")
          .select("id,user_id,category,can_approve")
          .eq("organization_id", context.organization.id)
          .is("knowledge_chunk_id", null)
          .order("category")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    rolesError ||
    membersError ||
    invitesError ||
    assignmentsError ||
    inviteCountError ||
    expertsError
  )
    throw new Error("Your team could not be loaded. Please try again.");
  const shaped = (members ?? []).map((member) => {
    const raw = member.profiles as unknown;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as {
      full_name: string | null;
      email: string;
    } | null;
    return {
      ...member,
      profile,
    };
  });
  const roleNames = new Map((roles ?? []).map((role) => [role.id, role.name]));
  const shapedInvites = (invites ?? []).map((invite) => ({
    ...invite,
    role: invite.role_id
      ? { name: roleNames.get(invite.role_id) ?? "Assigned role" }
      : null,
  }));
  return (
    <>
      <PageHeading
        title="Team"
        description={
          context.isAdmin
            ? "Invite teammates and control what company knowledge they can access."
            : "See the people you work with and how everyone fits together."
        }
        actions={
          context.isAdmin ? (
            <Link
              href="/app/roles"
              data-guide="team.roles"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8e0ea] bg-white px-4 text-sm font-semibold text-[#53627a]"
            >
              Manage roles <ArrowRight className="size-4" />
            </Link>
          ) : null
        }
      />
      {context.isAdmin ? (
        <nav className="product-subnav" aria-label="Team">
          <Link href="/app/team" aria-current="page">
            People
          </Link>
          <Link href="/app/training">Learning</Link>
          <Link href="/app/roles">Roles & access</Link>
        </nav>
      ) : null}
      <WorkspaceNotice action="Managing people in" />
      {context.isAdmin ? (
        <details className="mb-5 border-b border-[var(--opryn-line)] pb-4 text-sm leading-6 text-[var(--opryn-muted)]">
          <summary className="cursor-pointer py-2 font-semibold text-[var(--opryn-ink)]">
            How access works
          </summary>
          <p className="mt-2">
            Owners and admins manage workspace settings, connections, billing,
            and company knowledge. Members use knowledge available to their
            role. Job roles organize relevant processes; they do not grant
            administrator access.
          </p>
          <p className="mt-2">
            Expertise routes questions to the right person. Approval authority
            is assigned separately below. Transfer pending questions and
            knowledge responsibilities before removing someone.
          </p>
        </details>
      ) : null}
      <TeamManager
        roles={(roles ?? []).map((role) => ({
          ...role,
          processCount: (processAssignments ?? []).filter(
            (assignment) => assignment.role_id === role.id,
          ).length,
        }))}
        members={shaped}
        invites={shapedInvites}
        invitedCount={invitedCount ?? 0}
        currentUserId={context.user.id}
        canManage={context.isAdmin}
      />
      {context.isAdmin ? (
        <KnowledgeExperts
          people={shaped.map((member) => ({
            id: member.user_id,
            name:
              member.profile?.full_name || member.profile?.email || "Teammate",
          }))}
          experts={(experts ?? []).map((expert) => {
            const person = shaped.find(
              (member) => member.user_id === expert.user_id,
            );
            return {
              id: expert.id,
              userId: expert.user_id,
              name:
                person?.profile?.full_name ||
                person?.profile?.email ||
                "Teammate",
              category: expert.category || "Company knowledge",
              canApprove: expert.can_approve,
            };
          })}
        />
      ) : null}
    </>
  );
}
