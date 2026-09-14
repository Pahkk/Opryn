import { AskOpryn } from "@/components/app/ask-opryn";
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
  return (
    <>
      <PageHeading
        title="Ask Opryn"
        description="Your company's approved knowledge. A clear answer, with its source."
      />
      <AskOpryn
        hasKnowledge={accessible.length > 0}
        prompts={prompts}
        initialQuestion={q?.slice(0, 4000) ?? ""}
      />
    </>
  );
}
