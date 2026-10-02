import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminContext } from "@/lib/app-context";
import { createServiceClient } from "@/lib/supabase/service";
import { getKnowledgeImpact } from "@/lib/opryn/knowledge/impact";
import { KnowledgeImpactView } from "@/components/app/knowledge-impact";

export default async function KnowledgeImpactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdminContext();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const impact = await getKnowledgeImpact(
    createServiceClient(),
    context.organization.id,
    id,
  );
  if (!impact) notFound();
  return <KnowledgeImpactView impact={impact} />;
}
