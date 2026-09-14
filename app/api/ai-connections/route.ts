import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import {
  EXTERNAL_AI_SCOPES,
  EXTERNAL_AI_SOURCE_TYPES,
} from "@/lib/external-ai/constants";
import { getExternalAIAdminContext } from "@/lib/external-ai/admin";
import {
  displayKeyPrefix,
  generateAgentCredentials,
  hashAgentKey,
} from "@/lib/external-ai/keys";

const accessSchema = z.object({
  sourceType: z.enum(EXTERNAL_AI_SOURCE_TYPES),
  sourceId: z.string().uuid().nullable().optional(),
});
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  provider: z.enum([
    "openai",
    "claude",
    "voice_agent",
    "website_chatbot",
    "custom_agent",
    "other",
  ]),
  description: z.string().trim().max(1000).default(""),
  knowledgeMode: z.enum(["manual", "all_approved"]).default("manual"),
  scopes: z.array(z.enum(EXTERNAL_AI_SCOPES)).min(1),
  access: z.array(accessSchema).max(200).default([]),
});

export async function GET() {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const org = context.membership.organization_id;
  const { data, error } = await context.supabase
    .from("external_ai_connections")
    .select(
      "id,agent_id,name,provider,description,status,knowledge_mode,last_used_at,created_at",
    )
    .eq("organization_id", org)
    .order("created_at", { ascending: false });
  if (error) return apiError(error, "AI connections could not be loaded.");
  return NextResponse.json({ connections: data ?? [] });
}

export async function POST(request: Request) {
  const context = await getExternalAIAdminContext();
  if ("error" in context) return context.error;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the connection details and permissions." },
      { status: 400 },
    );
  const { supabase, user, membership } = context;
  const organizationId = membership.organization_id;
  const { agentId, apiKey } = generateAgentCredentials();
  let connectionId: string | null = null;
  try {
    const { data: connection, error: connectionError } = await supabase
      .from("external_ai_connections")
      .insert({
        agent_id: agentId,
        organization_id: organizationId,
        name: parsed.data.name,
        provider: parsed.data.provider,
        description: parsed.data.description,
        knowledge_mode: parsed.data.knowledgeMode,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (connectionError) throw connectionError;
    connectionId = connection.id;
    const [scopeResult, accessResult, keyResult] = await Promise.all([
      supabase.from("external_ai_scopes").insert(
        parsed.data.scopes.map((scope) => ({
          organization_id: organizationId,
          connection_id: connection.id,
          scope,
        })),
      ),
      parsed.data.knowledgeMode === "manual" && parsed.data.access.length
        ? supabase.from("external_ai_knowledge_access").insert(
            parsed.data.access.map((access) => ({
              organization_id: organizationId,
              connection_id: connection.id,
              source_type: access.sourceType,
              source_id: access.sourceId ?? null,
            })),
          )
        : Promise.resolve({ error: null }),
      supabase.from("external_ai_api_keys").insert({
        organization_id: organizationId,
        connection_id: connection.id,
        key_prefix: displayKeyPrefix(apiKey),
        key_hash: hashAgentKey(apiKey),
      }),
    ]);
    const error = scopeResult.error || accessResult.error || keyResult.error;
    if (error) throw error;
    return NextResponse.json(
      { connectionId: connection.id, agentId, apiKey },
      { status: 201, headers: { "cache-control": "no-store, private" } },
    );
  } catch (error) {
    if (connectionId)
      await supabase
        .from("external_ai_connections")
        .delete()
        .eq("id", connectionId)
        .eq("organization_id", organizationId);
    return apiError(error, "The AI connection could not be created.");
  }
}
