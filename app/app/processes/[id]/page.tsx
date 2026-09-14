import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, CheckCircle2, PlayCircle, UserRound } from "lucide-react";
import { ProcessReview } from "@/components/app/process-review";
import { ProcessDetailGuide } from "@/components/app/process-intelligence";
import { ProcessChecklist } from "@/components/app/process-checklist";
import { PageHeading } from "@/components/app/page-heading";
import { requireAppContext } from "@/lib/app-context";
import { safeAppReturnPath } from "@/lib/return-path";
import { createClient } from "@/lib/supabase/server";

export default async function ProcessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { returnTo, edit } = await searchParams;
  const returnPath = safeAppReturnPath(returnTo, "/app/processes");
  const context = await requireAppContext();
  const supabase = await createClient();
  const { data: process, error: processError } = await supabase
    .from("processes")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (processError) {
    console.error("Unable to load process", {
      processId: id,
      code: processError.code,
    });
    throw new Error("Unable to load this process.");
  }
  if (!process) notFound();

  const [
    stepsResult,
    rulesResult,
    exceptionsResult,
    clarificationsResult,
    mediaResult,
    assignmentsResult,
    rolesResult,
    membersResult,
  ] = await Promise.all([
    supabase
      .from("process_steps")
      .select("id, step_order, title, description")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id)
      .order("step_order"),
    supabase
      .from("process_rules")
      .select("id, title, text, confidence, status")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id),
    supabase
      .from("process_exceptions")
      .select("text")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id),
    supabase
      .from("clarification_questions")
      .select("id, question, answer, suggested_rule")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id),
    supabase
      .from("media_uploads")
      .select("id, original_name, storage_path, status, mime_type")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("process_role_assignments")
      .select("role_id")
      .eq("organization_id", context.organization.id)
      .eq("process_id", id),
    supabase
      .from("roles")
      .select("id,name")
      .eq("organization_id", context.organization.id),
    supabase
      .from("organization_members")
      .select("user_id,permission_level")
      .eq("organization_id", context.organization.id),
  ]);

  const relatedError = [
    stepsResult.error,
    rulesResult.error,
    exceptionsResult.error,
    clarificationsResult.error,
    mediaResult.error,
    assignmentsResult.error,
    rolesResult.error,
    membersResult.error,
  ].find(Boolean);
  if (relatedError) {
    console.error("Unable to load process details", {
      processId: id,
      code: relatedError.code,
    });
    throw new Error("Unable to load this process.");
  }
  type StepRow = {
    id: string;
    step_order: number;
    title: string;
    description: string;
  };
  type RuleRow = {
    id: string;
    title: string;
    text: string;
    confidence: number | null;
    status: string;
  };
  type ExceptionRow = { text: string };
  type ClarificationRow = {
    id: string;
    question: string;
    answer: string | null;
    suggested_rule: string | null;
  };
  const steps = ([...(stepsResult.data ?? [])] as StepRow[]).sort(
    (a, b) => a.step_order - b.step_order,
  );
  const rules = (rulesResult.data ?? ([] as RuleRow[])).filter(
    (rule: RuleRow) => context.isAdmin || rule.status === "approved",
  ) as RuleRow[];
  const { data: creator } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", process.created_by)
    .maybeSingle();
  const typedCreator = creator as {
    full_name: string | null;
    email: string;
  } | null;
  const media = mediaResult.data?.[0];
  const roleNames = new Map(
    (rolesResult.data ?? []).map((role) => [role.id, role.name]),
  );
  const assignedRoles = (assignmentsResult.data ?? [])
    .map((assignment) => roleNames.get(assignment.role_id))
    .filter((name): name is string => Boolean(name));
  const memberIds = (membersResult.data ?? []).map((member) => member.user_id);
  const { data: memberProfiles, error: memberProfilesError } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", memberIds)
    : { data: [], error: null };
  if (memberProfilesError) throw new Error("Unable to load process experts.");
  const processGuide = (
    <ProcessDetailGuide
      processId={id}
      title={process.title}
      roles={assignedRoles}
      counts={{
        steps: steps.length,
        rules: rules.length,
        exceptions: exceptionsResult.data?.length ?? 0,
        questions: clarificationsResult.data?.length ?? 0,
      }}
    />
  );
  let mediaUrl: string | null = null;
  if (media?.storage_path) {
    const { data } = await supabase.storage
      .from("process-media")
      .createSignedUrl(media.storage_path, 3600);
    mediaUrl = data?.signedUrl ?? null;
  }
  const hasVideo = Boolean(mediaUrl && media?.mime_type.startsWith("video/"));
  const conversationSource =
    process.learning_source === "ai_conversation"
      ? process.source_provider === "chatgpt"
        ? "ChatGPT conversation"
        : process.source_provider === "claude"
          ? "Claude conversation"
          : "Selected AI conversation"
      : null;
  const { data: nextPending } =
    context.isAdmin && process.status !== "approved"
      ? await supabase
          .from("processes")
          .select("id,title")
          .eq("organization_id", context.organization.id)
          .eq("status", "needs_review")
          .neq("id", process.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : { data: null };
  if (context.isAdmin && (process.status !== "approved" || edit === "true"))
    return (
      <>
        <PageHeading
          eyebrow={
            process.status === "approved" ? "Approved process" : "Owner review"
          }
          title={process.title}
          description={
            conversationSource
              ? `Source: ${process.source_title || conversationSource}. Check every finding before it becomes trusted company knowledge.`
              : "Check every step and rule before this becomes trusted company knowledge."
          }
          actions={
            process.status === "approved" ? (
              <Link
                href={`/app/ask?q=${encodeURIComponent(`I have a question about ${process.title}`)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd8e5] bg-white px-4 text-sm font-semibold text-[#3158d8]"
              >
                Ask Opryn about this
              </Link>
            ) : undefined
          }
        />
        {processGuide}
        <ProcessReview
          returnTo={returnPath}
          roleOptions={(rolesResult.data ?? []).map((role) => ({
            id: role.id,
            label: role.name,
          }))}
          expertOptions={(memberProfiles ?? []).map((profile) => ({
            id: profile.id,
            label: profile.full_name || profile.email,
          }))}
          nextReview={nextPending}
          initial={{
            libraryCategory: process.library_category,
            libraryTags: process.library_tags,
            libraryRevision: process.library_revision,
            id: process.id,
            title: process.title,
            summary: process.summary,
            purpose: process.purpose,
            status: process.status,
            roleId: assignmentsResult.data?.[0]?.role_id ?? null,
            expertId: process.assigned_expert_id ?? null,
            criticality: process.criticality ?? "normal",
            steps: steps.map((step) => ({
              id: step.id,
              title: step.title,
              description: step.description,
            })),
            rules: rules.map((rule) => ({
              id: rule.id,
              title: rule.title,
              text: rule.text,
              confidence: rule.confidence,
            })),
            exceptions: (exceptionsResult.data ?? ([] as ExceptionRow[])).map(
              (item: ExceptionRow) => ({ text: item.text }),
            ),
            clarifications: (
              clarificationsResult.data ?? ([] as ClarificationRow[])
            ).map((item: ClarificationRow) => ({
              id: item.id,
              question: item.question,
              answer: item.answer ?? "",
              suggestedRule: item.suggested_rule ?? "",
            })),
          }}
        />
      </>
    );
  return (
    <article className="mx-auto max-w-4xl">
      <PageHeading
        eyebrow="Company process"
        title={process.title}
        description={process.summary}
        actions={
          <div className="flex flex-wrap gap-2">
            {context.isAdmin ? (
              <Link
                href={`/app/processes/${id}?edit=true`}
                className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd8e5] bg-white px-4 text-sm font-semibold text-[#3158d8]"
              >
                Edit Process
              </Link>
            ) : null}
            <Link
              href={`/app/ask?q=${encodeURIComponent(`I have a question about ${process.title}`)}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd8e5] bg-white px-4 text-sm font-semibold text-[#3158d8]"
            >
              Ask Opryn about this
            </Link>
          </div>
        }
      />
      {processGuide}
      <div className="mb-6 flex flex-wrap gap-3 text-xs text-[#6e7a8d]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
          <UserRound className="size-3.5" />
          {typedCreator?.full_name ?? typedCreator?.email ?? "Company owner"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5">
          <Calendar className="size-3.5" />
          Updated {new Date(process.updated_at).toLocaleDateString()}
        </span>
      </div>
      {hasVideo && mediaUrl ? (
        <section className="mb-6 rounded-2xl border border-[#dfe5ed] bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <PlayCircle className="size-5 text-[#3158d8]" />
            Source recording
          </h2>
          <video
            controls
            preload="metadata"
            className="mt-4 max-h-[420px] w-full rounded-xl bg-[#0d1729]"
            src={mediaUrl}
          >
            Your browser does not support video playback.
          </video>
        </section>
      ) : null}
      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-8">
        <h2 className="text-lg font-semibold">Purpose</h2>
        <p className="mt-2 text-sm leading-6 text-[#657286]">
          {process.purpose}
        </p>
        <ProcessChecklist processId={id} steps={steps} />
        {exceptionsResult.data?.length ? (
          <section className="mt-8 border-t border-[#e7ebf0] pt-6">
            <h2 className="text-lg font-semibold">Exceptions</h2>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-[#52627a]">
              {exceptionsResult.data.map((item, index) => (
                <li key={index} className="rounded-xl bg-[#f5f7fb] p-4">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {rules.length ? (
          <div className="mt-9 border-t border-[#e7ebf0] pt-7">
            <h2 className="text-lg font-semibold">Company rules</h2>
            <div className="mt-4 space-y-3">
              {rules.map((rule: RuleRow) => (
                <div
                  key={rule.id}
                  id={`rule-${rule.id}`}
                  className="flex scroll-mt-28 gap-3 rounded-xl bg-[#f3f7ff] p-4 target:ring-4 target:ring-[#3158d8]/20"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#3158d8]" />
                  <div>
                    <h3 className="text-sm font-semibold">{rule.title}</h3>
                    <p className="mt-1 text-sm leading-5 text-[#5f6d82]">
                      {rule.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </article>
  );
}
