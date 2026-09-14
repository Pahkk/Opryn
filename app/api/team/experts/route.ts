import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const createSchema = z.object({
  userId: z.string().uuid(),
  category: z.string().trim().min(2).max(120),
  canApprove: z.boolean().default(false),
});
const deleteSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a teammate and knowledge area." },
      { status: 400 },
    );
  const { supabase, membership } = context;
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", membership.organization_id)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (!member)
    return NextResponse.json(
      { error: "That person is not in this team." },
      { status: 400 },
    );
  try {
    const { data: existing } = await supabase
      .from("knowledge_experts")
      .select("id")
      .eq("organization_id", membership.organization_id)
      .eq("user_id", parsed.data.userId)
      .ilike("category", parsed.data.category)
      .is("knowledge_chunk_id", null)
      .maybeSingle();
    const query = existing
      ? supabase
          .from("knowledge_experts")
          .update({
            category: parsed.data.category,
            can_approve: parsed.data.canApprove,
          })
          .eq("id", existing.id)
      : supabase.from("knowledge_experts").insert({
          organization_id: membership.organization_id,
          user_id: parsed.data.userId,
          category: parsed.data.category,
          priority: 1,
          can_approve: parsed.data.canApprove,
        });
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "Opryn couldn't assign that expert.");
  }
}

export async function DELETE(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Expert assignment not found." },
      { status: 400 },
    );
  const { error } = await context.supabase
    .from("knowledge_experts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("organization_id", context.membership.organization_id);
  if (error)
    return apiError(error, "Opryn couldn't remove that expert assignment.");
  return NextResponse.json({ ok: true });
}
