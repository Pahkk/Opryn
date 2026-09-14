import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import {
  EXTERNAL_AI_SCOPES,
  EXTERNAL_AI_SOURCE_TYPES,
} from "@/lib/external-ai/constants";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(["active", "paused"]).optional(),
  knowledgeMode: z.enum(["manual", "all_approved"]).optional(),
  scopes: z.array(z.enum(EXTERNAL_AI_SCOPES)).min(1).optional(),
  access: z
    .array(
      z.object({
        sourceType: z.enum(EXTERNAL_AI_SOURCE_TYPES),
        sourceId: z.string().uuid().nullable().optional(),
      }),
    )
    .max(200)
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "The connection settings are invalid." },
      { status: 400 },
    );
  const { id } = await params;
  const org = context.membership.organization_id;
  const { data: existing } = await context.supabase
    .from("external_ai_connections")
    .select("id,knowledge_mode")
    .eq("id", id)
    .eq("organization_id", org)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "Connection not found." },
      { status: 404 },
    );
  try {
    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.knowledgeMode !== undefined)
      updates.knowledge_mode = parsed.data.knowledgeMode;
    if (Object.keys(updates).length) {
      const { error } = await context.supabase
        .from("external_ai_connections")
        .update(updates)
        .eq("id", id)
        .eq("organization_id", org);
      if (error) throw error;
    }
    if (parsed.data.scopes) {
      await context.supabase
        .from("external_ai_scopes")
        .delete()
        .eq("connection_id", id)
        .eq("organization_id", org);
      const { error } = await context.supabase
        .from("external_ai_scopes")
        .insert(
          parsed.data.scopes.map((scope) => ({
            organization_id: org,
            connection_id: id,
            scope,
          })),
        );
      if (error) throw error;
    }
    if (parsed.data.access) {
      await context.supabase
        .from("external_ai_knowledge_access")
        .delete()
        .eq("connection_id", id)
        .eq("organization_id", org);
      if (parsed.data.access.length) {
        const { error } = await context.supabase
          .from("external_ai_knowledge_access")
          .insert(
            parsed.data.access.map((item) => ({
              organization_id: org,
              connection_id: id,
              source_type: item.sourceType,
              source_id: item.sourceId ?? null,
            })),
          );
        if (error) throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "The connection settings could not be saved.");
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  const { error } = await context.supabase
    .from("external_ai_connections")
    .delete()
    .eq("id", id)
    .eq("organization_id", context.membership.organization_id);
  if (error) return apiError(error, "The connection could not be deleted.");
  return NextResponse.json({ ok: true });
}
