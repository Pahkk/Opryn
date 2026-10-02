import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { ConnectionError } from "@/lib/integrations/nango";
import { requireNangoCapability } from "@/lib/integrations/nango-capabilities";
import {
  containsForbiddenIdentity,
  listSelectableSources,
  resolveSelectableSource,
  sanitizeProviderMetadata,
  type KnowledgeProvider,
} from "@/lib/integrations/content-providers";

const providers = z.enum(["notion", "confluence"]);
const selectionSchema = z
  .object({
    selections: z
      .array(
        z
          .object({
            externalId: z.string().min(1).max(500),
            sourceType: z.enum(["page", "database", "space"]),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    const { id } = await params;
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const provider = providers.parse(connection.provider) as KnowledgeProvider;
    const query =
      new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    const [available, selected] = await Promise.all([
      listSelectableSources(provider, connection, query),
      createServiceClient()
        .from("integration_sources")
        .select(
          "id,external_id,source_type,title,parent_context,external_url,modified_at,provider_version,process_id,sync_status,last_checked_at,last_imported_at",
        )
        .eq("organization_id", context.membership.organization_id)
        .eq("integration_id", id)
        .order("selected_at"),
    ]);
    if (selected.error) throw selected.error;
    return NextResponse.json(
      { available, selected: selected.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, "Could not load provider content.");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const { id } = await params;
    const body = selectionSchema.parse(await request.json());
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const provider = providers.parse(connection.provider) as KnowledgeProvider;
    const unique = [
      ...new Map(
        body.selections.map((item) => [
          `${item.sourceType}:${item.externalId}`,
          item,
        ]),
      ).values(),
    ];
    const available = await listSelectableSources(provider, connection, "");
    const resolved = await Promise.all(
      unique.map((item) => {
        const known = available.find(
          (source) =>
            source.externalId === item.externalId &&
            source.sourceType === item.sourceType,
        );
        return (
          known ??
          resolveSelectableSource(
            provider,
            connection,
            item.externalId,
            item.sourceType,
          )
        );
      }),
    );
    const rows = resolved.map((source) => {
      const metadata = sanitizeProviderMetadata({
        sourceType: source.sourceType,
      });
      if (containsForbiddenIdentity(metadata))
        throw new ConnectionError(
          "Provider identity metadata was rejected.",
          422,
        );
      return {
        organization_id: context.membership.organization_id,
        integration_id: id,
        provider,
        external_id: source.externalId,
        source_type: source.sourceType,
        title: source.title,
        parent_context: source.parentContext,
        external_url: source.externalUrl,
        provider_version: source.providerVersion,
        modified_at: source.modifiedAt,
        metadata,
      };
    });
    const saved = await createServiceClient()
      .from("integration_sources")
      .upsert(rows, { onConflict: "integration_id,external_id,source_type" })
      .select(
        "id,external_id,source_type,title,parent_context,external_url,modified_at,provider_version,process_id,sync_status,last_checked_at,last_imported_at",
      );
    if (saved.error) throw saved.error;
    return NextResponse.json({ selected: saved.data });
  } catch (error) {
    return failure(error, "Could not save those sources.");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const { id } = await params;
    const body = z
      .object({ sourceId: z.uuid() })
      .strict()
      .parse(await request.json());
    await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const removed = await createServiceClient()
      .from("integration_sources")
      .delete()
      .eq("id", body.sourceId)
      .eq("integration_id", id)
      .eq("organization_id", context.membership.organization_id);
    if (removed.error) throw removed.error;
    return NextResponse.json({ removed: true });
  } catch (error) {
    return failure(error, "Could not remove that source.");
  }
}

function failure(error: unknown, fallback: string) {
  return NextResponse.json(
    {
      error:
        error instanceof ConnectionError
          ? error.message
          : error instanceof z.ZodError
            ? error.issues[0]?.message
            : fallback,
    },
    {
      status:
        error instanceof ConnectionError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 503,
    },
  );
}
