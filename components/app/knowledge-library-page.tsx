import Link from "next/link";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { embedKnowledge } from "@/lib/ai/services";
import { KnowledgeLibrary } from "./knowledge-library";
import {
  KNOWLEDGE_CATEGORIES,
  LIBRARY_VIEWS,
  type LibraryItem,
} from "@/lib/knowledge-library";
const fields =
  "id,entity,title,content,category,tags,revision,status,source,source_title,source_url,process_id,updated_at,confirmed_at,usage_count,version,review_required";

export default async function KnowledgeLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const db = await createClient();
  const filters: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(filters.page) || 1)),
  );
  const requestedCategory =
    filters.category ||
    (
      { processes: "process", faqs: "faq", rules: "policy" } as Record<
        string,
        string
      >
    )[filters.type || ""] ||
    "";
  const category = Object.hasOwn(KNOWLEDGE_CATEGORIES, requestedCategory)
    ? requestedCategory
    : "";
  const view =
    (filters.view && Object.hasOwn(LIBRARY_VIEWS, filters.view)
      ? filters.view
      : null) ||
    (filters.q || filters.status || category || filters.source
      ? "all"
      : "overview");
  let query = db
    .from("searchable_company_knowledge")
    .select(fields, { count: "exact" })
    .eq("organization_id", context.organization.id);
  if (category) query = query.eq("category", category);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source) query = query.eq("source", filters.source);
  if (view === "needs_review") query = query.eq("status", "needs_review");
  if (view === "conflict") query = query.eq("status", "conflict");
  if (view === "uncategorized") query = query.eq("category", "uncategorized");
  if (view === "used") query = query.gt("usage_count", 0);
  if (view === "outdated") query = query.eq("due_for_review", true);
  const days = Number(filters.days || (view === "recent" ? 7 : 0));
  if ([1, 7, 30].includes(days))
    query = query.gte(
      "updated_at",
      new Date(new Date().getTime() - days * 86400000).toISOString(),
    );
  if (filters.q?.trim()) {
    const q = filters.q
      .trim()
      .slice(0, 250)
      .replace(/[%,_()."\\]/g, " ")
      .trim();
    let ids: string[] = [];
    try {
      const [embedding] = await embedKnowledge([q]);
      const matches = await db.rpc("match_knowledge", {
        target_organization_id: context.organization.id,
        query_embedding: embedding,
        target_role_id: context.membership.roleId,
        match_threshold: 0.3,
        match_count: 20,
      });
      ids = (matches.data ?? []).flatMap(
        (item: { id: string; process_id?: string }) =>
          [item.id, item.process_id].filter(
            (id): id is string => !!id && /^[0-9a-f-]{36}$/i.test(id),
          ),
      );
    } catch {
      /* lexical search remains available */
    }
    query = query.or(
      `search_text.ilike.%${q}%${ids.length ? `,id.in.(${ids.join(",")})` : ""}`,
    );
  }
  const size = view === "overview" ? 6 : 30;
  query = query
    .order(view === "used" ? "usage_count" : "updated_at", { ascending: false })
    .order("id")
    .range((page - 1) * size, page * size - 1);
  const [items, facets, review, used, linked] = await Promise.all([
    query,
    db.rpc("knowledge_library_facets", {
      target_organization_id: context.organization.id,
    }),
    view === "overview"
      ? db
          .from("company_knowledge_library")
          .select("*")
          .eq("organization_id", context.organization.id)
          .eq("status", "needs_review")
          .order("updated_at", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
    view === "overview"
      ? db
          .from("company_knowledge_library")
          .select("*")
          .eq("organization_id", context.organization.id)
          .gt("usage_count", 0)
          .order("usage_count", { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [], error: null }),
    filters.knowledge && /^[0-9a-f-]{36}$/i.test(filters.knowledge)
      ? db
          .from("company_knowledge_library")
          .select("*")
          .eq("organization_id", context.organization.id)
          .eq("id", filters.knowledge)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (items.error || facets.error || review.error || used.error)
    return (
      <section>
        <h1 className="opryn-page-title">Knowledge</h1>
        <p className="mt-4">
          Your knowledge library could not load. Your existing knowledge is
          unchanged.
        </p>
        <Link className="opryn-action mt-5" href="/app/processes">
          Retry
        </Link>
        <Link className="ml-5" href="/app/needs-you">
          Open Needs You
        </Link>
      </section>
    );
  return (
    <KnowledgeLibrary
      initialItem={linked.data as LibraryItem | null}
      items={(items.data ?? []) as LibraryItem[]}
      reviewItems={(review.data ?? []) as LibraryItem[]}
      usedItems={(used.data ?? []) as LibraryItem[]}
      total={items.count ?? 0}
      categories={facets.data.categories ?? {}}
      sources={facets.data.sources ?? []}
      filters={{ ...filters, category, view }}
      page={page}
      pageSize={size}
      canManage={context.isAdmin}
      organizationName={context.organization.name}
    />
  );
}
