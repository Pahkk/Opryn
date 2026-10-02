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
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open connection settings in Opryn." },
      { status: 403 },
    );
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
    const { error } = await context.supabase.rpc(
      "update_training_agent_connection",
      {
        target_org: org,
        target_connection: id,
        settings_value: parsed.data,
      },
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, "The connection settings could not be saved.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open connection settings in Opryn." },
      { status: 403 },
    );
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const { id } = await params;
  const { error } = await context.supabase.rpc("disconnect_training_agent", {
    target_org: context.membership.organization_id,
    target_connection: id,
  });
  if (error)
    return apiError(
      error,
      "The agent could not be disconnected. Its history is retained.",
    );
  return NextResponse.json({ ok: true });
}
