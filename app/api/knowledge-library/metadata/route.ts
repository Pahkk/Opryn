import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-library";

export async function PATCH(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const parsed = z
    .object({
      id: z.uuid(),
      entity: z.enum(["process", "knowledge", "proposal"]),
      revision: z.number().int().positive(),
      category: z
        .string()
        .refine((value) => Object.hasOwn(KNOWLEDGE_CATEGORIES, value)),
      tags: z.array(z.string().trim().min(1).max(60)).max(12),
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a category and up to 12 tags." },
      { status: 400 },
    );
  const body = parsed.data;
  const table = {
    process: "processes",
    knowledge: "knowledge_chunks",
    proposal: "knowledge_proposals",
  }[body.entity];
  const { data, error } = await context.supabase
    .from(table)
    .update({
      library_category: body.category,
      library_tags: [...new Set(body.tags)],
      library_revision: body.revision + 1,
    })
    .eq("id", body.id)
    .eq("organization_id", context.membership.organization_id)
    .eq("library_revision", body.revision)
    .select("id,updated_at")
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Classification could not be saved." },
      { status: 503 },
    );
  if (!data)
    return NextResponse.json(
      {
        error:
          "This item changed or is no longer available. Reload before saving.",
      },
      { status: 409 },
    );
  return NextResponse.json({
    revision: body.revision + 1,
    updatedAt: data.updated_at,
  });
}
