import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { knowledgeScopeSchema } from "@/lib/opryn/knowledge/scope";

export async function GET(request: Request) {
  const ctx = await getRequestContext();
  if ("error" in ctx) return ctx.error;
  const params = new URL(request.url).searchParams;
  const id = params.get("id"),
    entity = params.get("entity");
  if (
    !z.uuid().safeParse(id).success ||
    !["knowledge", "proposal"].includes(entity ?? "")
  )
    return NextResponse.json(
      { error: "Choose a knowledge item." },
      { status: 400 },
    );
  const result = await ctx.supabase
    .from(entity === "proposal" ? "knowledge_proposals" : "knowledge_chunks")
    .select(
      entity === "proposal"
        ? "scope,version,updated_at"
        : "scope,current_version",
    )
    .eq("organization_id", ctx.membership.organization_id)
    .eq("id", id!)
    .maybeSingle();
  if (result.error) return apiError(result.error);
  if (!result.data)
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  return NextResponse.json(result.data);
}
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json(
      { error: "This action must start in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const parsed = z
    .object({
      id: z.uuid(),
      entity: z.enum(["knowledge", "proposal"]),
      version: z.number().int().positive(),
      updatedAt: z.iso.datetime({ offset: true }).optional(),
      scope: knowledgeScopeSchema,
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the scope and refresh this item." },
      { status: 400 },
    );
  const p = parsed.data;
  if (p.entity === "proposal" && !p.updatedAt)
    return NextResponse.json(
      { error: "Refresh this proposal first." },
      { status: 400 },
    );
  const result =
    p.entity === "proposal"
      ? await ctx.supabase.rpc("set_knowledge_proposal_scope", {
          target_org: ctx.membership.organization_id,
          target_proposal: p.id,
          expected_revision: p.version,
          expected_updated: p.updatedAt,
          value: p.scope,
        })
      : await ctx.supabase.rpc("propose_knowledge_scope", {
          target_org: ctx.membership.organization_id,
          target_knowledge: p.id,
          expected_revision: p.version,
          value: p.scope,
        });
  if (result.error) {
    const status =
      result.error.code === "42501"
        ? 403
        : result.error.code === "40001"
          ? 409
          : result.error.code === "P0002"
            ? 404
            : result.error.code === "22023"
              ? 400
              : 500;
    return status === 500
      ? apiError(result.error)
      : NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json(
    p.entity === "knowledge" ? { proposalId: result.data } : result.data,
  );
}
