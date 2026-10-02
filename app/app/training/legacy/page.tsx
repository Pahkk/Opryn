import Link from "next/link";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeading, EmptyState } from "@/components/app/page-heading";
import { TrainingManager } from "@/components/app/training-manager";
import {
  MyLearning,
  RoleLearningAssignment,
} from "@/components/app/learning-workspace";

export default async function TrainingPage() {
  const context = await requireAppContext();
  const supabase = await createClient();
  const org = context.organization.id;
  let assignmentQuery = supabase
    .from("training_assignments")
    .select(
      "id,user_id,process_id,status,completed_at,learning_state,acknowledged_process_updated_at,practiced_process_updated_at",
    )
    .eq("organization_id", org);
  if (!context.isAdmin)
    assignmentQuery = assignmentQuery.eq("user_id", context.user.id);
  const [
    processResult,
    assignmentResult,
    membersResult,
    rolesResult,
    requirementsResult,
  ] = await Promise.all([
    supabase
      .from("processes")
      .select("id,title,summary,updated_at,library_category")
      .eq("organization_id", org)
      .eq("status", "approved")
      .is("library_archived_at", null)
      .order("title"),
    assignmentQuery,
    context.isAdmin
      ? supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", org)
      : Promise.resolve({ data: [], error: null }),
    context.isAdmin
      ? supabase
          .from("roles")
          .select("id,name")
          .eq("organization_id", org)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    context.isAdmin
      ? supabase
          .from("role_learning_requirements")
          .select("role_id,process_id")
          .eq("organization_id", org)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (
    processResult.error ||
    assignmentResult.error ||
    membersResult.error ||
    rolesResult.error ||
    requirementsResult.error
  )
    throw new Error(
      "Learning couldn't be loaded. Your progress is saved; please try again.",
    );
  const processes = processResult.data ?? [];
  const accessible = new Set(processes.map((item) => item.id));
  const assignments = (assignmentResult.data ?? []).filter((item) =>
    accessible.has(item.process_id),
  );
  const ids = (membersResult.data ?? []).map((item) => item.user_id);
  const peopleResult =
    context.isAdmin && ids.length
      ? await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids)
      : { data: [], error: null };
  if (peopleResult.error) throw new Error("Your team couldn't be loaded.");
  const assigned = new Map(assignments.map((item) => [item.process_id, item]));
  const myProcesses = processes.filter((item) => assigned.has(item.id));
  return (
    <div data-guide="team.learning">
      <PageHeading
        title={context.isAdmin ? "Team learning" : "What you need to know"}
        description={
          context.isAdmin
            ? "Help people learn how your business works, using approved company knowledge."
            : "Your assigned processes. Read the guidance, ask a question, then continue."
        }
      />
      {context.isAdmin ? (
        <>
          <nav className="product-subnav" aria-label="Team">
            <Link href="/app/team">People</Link>
            <Link href="/app/training" aria-current="page">
              Learning
            </Link>
            <Link href="/app/roles">Roles & access</Link>
          </nav>
          <RoleLearningAssignment
            roles={rolesResult.data ?? []}
            processes={processes}
            requirements={requirementsResult.data ?? []}
          />
          <p className="mb-4 text-sm text-[#566279]">
            Existing “completed” records are self-reported. New learning
            distinguishes viewed, current-version acknowledgement and practice;
            none certifies mastery. Role-required assignments are managed above;
            individual assignments below cannot remove a role requirement.
          </p>
          <TrainingManager
            people={(peopleResult.data ?? []).map((person) => ({
              id: person.id,
              name: person.full_name || person.email,
              email: person.email,
              roleName: null,
            }))}
            processes={processes.map((process) => ({
              ...process,
              summary: process.summary ?? "",
              roleNames: [],
              hasVideo: false,
              imageCount: 0,
            }))}
            initialAssignments={assignments}
          />
        </>
      ) : myProcesses.length ? (
        <MyLearning processes={myProcesses} assignments={assignments} />
      ) : (
        <EmptyState
          icon={null}
          title="No learning assigned yet"
          description="You can still explore approved knowledge or ask a company question."
          action={
            <Link href="/app/ask" className="opryn-action">
              Ask Opryn
            </Link>
          }
        />
      )}
    </div>
  );
}
