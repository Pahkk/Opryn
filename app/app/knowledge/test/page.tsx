import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/app/page-heading";
import { KnowledgeTestbench } from "@/components/app/knowledge-testbench";

export default async function TestPage({
  searchParams,
}: {
  searchParams: Promise<{
    knowledgeId?: string;
    connectionId?: string;
    testId?: string;
  }>;
}) {
  const [context, supabase, query] = await Promise.all([
    requireAdminContext(),
    createClient(),
    searchParams,
  ]);
  const org = context.organization.id;
  const [members, connections, knowledge] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "user_id,permission_level,profiles!organization_members_user_id_fkey(full_name)",
      )
      .eq("organization_id", org),
    supabase
      .from("external_ai_connections")
      .select("id,name,status")
      .eq("organization_id", org)
      .order("name"),
    supabase
      .from("knowledge_chunks")
      .select("id,content,current_version")
      .eq("organization_id", org)
      .eq("approved", true)
      .is("library_archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (members.error || connections.error || knowledge.error)
    throw Error("Test Opryn could not load workspace access options.");
  const people = (members.data ?? []).map((m) => {
    const raw = m.profiles as unknown;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as {
      full_name: string | null;
    } | null;
    return {
      id: m.user_id,
      name: `${profile?.full_name ?? "Workspace member"} · ${m.permission_level}`,
    };
  });
  return (
    <>
      <PageHeading
        eyebrow="Knowledge"
        title="Test what Opryn would say."
        description="Opryn response simulation. Check approved answers and actual access before relying on them."
      />
      <KnowledgeTestbench
        people={people}
        connections={connections.data ?? []}
        knowledge={(knowledge.data ?? []).map((k) => ({
          id: k.id,
          title: k.content.split(":")[0].slice(0, 120),
          version: k.current_version,
        }))}
        defaultActorId={context.user.id}
        initialKnowledgeId={query.knowledgeId}
        initialConnectionId={query.connectionId}
        initialTestId={query.testId}
      />
    </>
  );
}
