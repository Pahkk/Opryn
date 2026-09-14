import { NeedsYouCenter } from "@/components/app/needs-you-center";
import { requireAppContext } from "@/lib/app-context";
import { getNeedsYouItems } from "@/lib/opryn/needs-you";
import { createClient } from "@/lib/supabase/server";

export default async function NeedsYouPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; filter?: string }>;
}) {
  const [context, query] = await Promise.all([
    requireAppContext(),
    searchParams,
  ]);
  const supabase = await createClient();
  const items = await getNeedsYouItems({
    service: supabase,
    organizationId: context.organization.id,
    userId: context.user.id,
    isAdmin: context.isAdmin,
  });
  return (
    <NeedsYouCenter
      initialItems={items}
      initialItemId={query.item ?? null}
      initialFilter={query.filter ?? null}
    />
  );
}
