import Link from "next/link";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeading, EmptyState } from "@/components/app/page-heading";
import { TrainingManager } from "@/components/app/training-manager";
import { TrainingButton } from "@/components/app/training-button";

export default async function TrainingPage() {
  const context = await requireAppContext();
  const supabase = await createClient();
  const org = context.organization.id;
  let assignmentQuery = supabase
    .from("training_assignments")
    .select("id,user_id,process_id,status,completed_at")
    .eq("organization_id", org);
  if (!context.isAdmin)
    assignmentQuery = assignmentQuery.eq("user_id", context.user.id);
  const [processResult, assignmentResult, membersResult] = await Promise.all([
    supabase
      .from("processes")
      .select("id,title,summary")
      .eq("organization_id", org)
      .eq("status", "approved")
      .order("title"),
    assignmentQuery,
    context.isAdmin
      ? supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", org)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (processResult.error || assignmentResult.error || membersResult.error)
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
    <>
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
        <section className="space-y-4" aria-label="My Learning">
          {myProcesses.map((process) => (
            <article key={process.id} className="opryn-surface p-5 sm:p-6">
              <p className="opryn-section-label">
                {assigned.get(process.id)?.status === "completed"
                  ? "Completed"
                  : "Assigned to you"}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {process.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--opryn-muted)]">
                {process.summary}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  className="opryn-action"
                  href={`/app/processes/${process.id}`}
                >
                  Read process
                </Link>
                <Link
                  className="opryn-secondary-action"
                  href={`/app/ask?q=${encodeURIComponent(`Walk me through ${process.title}.`)}`}
                >
                  Ask Opryn about this
                </Link>
                <TrainingButton
                  processId={process.id}
                  status={assigned.get(process.id)?.status ?? "assigned"}
                />
              </div>
            </article>
          ))}
          <p className="text-sm text-[var(--opryn-muted)]">
            Completed means you marked the process complete. It is not a
            proficiency assessment.
          </p>
        </section>
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
    </>
  );
}
