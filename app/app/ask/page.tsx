import { AskOpryn } from "@/components/app/ask-opryn";
import { ClarificationReplies } from "@/components/app/gap-question-actions";
import { PageHeading } from "@/components/app/page-heading";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, context, supabase] = await Promise.all([
    searchParams,
    requireAppContext(),
    createClient(),
  ]);
  // Session/RLS applies knowledge visibility; no industry or role-name guesses.
  const { data: chunks, error } = await supabase
    .from("knowledge_chunks")
    .select("id,content,process_id,rule_id,role_id")
    .eq("organization_id", context.organization.id)
    .eq("approved", true)
    .eq("health_status", "healthy")
    .order("last_confirmed_at", { ascending: false })
    .limit(20);
  if (error)
    throw new Error(
      "Your approved knowledge couldn't be loaded. Please try again.",
    );
  const accessible = (chunks ?? []).filter(
    (chunk) =>
      context.isAdmin ||
      !chunk.role_id ||
      chunk.role_id === context.membership.roleId,
  );
  const processIds = [
    ...new Set(
      accessible.flatMap((chunk) =>
        chunk.process_id ? [chunk.process_id] : [],
      ),
    ),
  ];
  const { data: processes, error: processError } = processIds.length
    ? await supabase
        .from("processes")
        .select("id,title")
        .eq("organization_id", context.organization.id)
        .eq("status", "approved")
        .in("id", processIds)
        .limit(8)
    : { data: [], error: null };
  if (processError)
    throw new Error("Your suggested questions couldn't be loaded.");
  const prompts = (processes ?? []).map((process) => ({
    category: "Approved process",
    text: `Walk me through ${process.title}.`,
  }));
  const { data: clarifications, error: clarificationError } = await supabase
    .from("question_clarifications")
    .select(
      "id,question_id,message,employee_questions!inner(question,asked_by)",
    )
    .eq("organization_id", context.organization.id)
    .eq("status", "open")
    .eq("employee_questions.asked_by", context.user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (clarificationError)
    throw new Error("Questions needing context could not be loaded.");
  return (
    <>
      <PageHeading
        eyebrow="Your company. One trusted answer."
        title="Ask Opryn"
        description="Ask a real work question. Get clear guidance, with the approved source attached."
      />
      <ClarificationReplies
        items={(clarifications ?? []).map((item) => {
          const raw = item.employee_questions as unknown;
          const question = (Array.isArray(raw) ? raw[0] : raw) as {
            question: string;
          };
          return {
            id: item.id,
            questionId: item.question_id,
            message: item.message,
            question: question.question,
          };
        })}
      />
      <AskOpryn
        workspaceName={context.organization.name}
        workspaceLogo={context.organization.logoUrl}
        hasKnowledge={accessible.length > 0}
        prompts={prompts}
        initialQuestion={q?.slice(0, 4000) ?? ""}
        canTest={context.isAdmin}
      />
    </>
  );
}
