import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { requireNangoCapability } from "@/lib/integrations/nango-capabilities";
import { ConnectionError } from "@/lib/integrations/nango";
import { LearningFileError } from "@/lib/ai/learning-file";
import { ensureGoogleSelectedSource } from "@/lib/integrations/google-source";
import { createServiceClient } from "@/lib/supabase/service";
import {
  importProviderSource,
  storedSourceSelect,
  type StoredSource,
} from "@/lib/integrations/source-import";

export const maxDuration = 180;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { supabase, membership, user } = context;
  try {
    const { id } = await params;
    const body = z
      .union([
        z.object({ fileId: z.string().regex(/^[\w-]{1,200}$/) }).strict(),
        z.object({ sourceId: z.string().uuid() }).strict(),
      ])
      .parse(await request.json());
    const limit = await supabase.rpc("consume_integration_auth_rate_limit", {
      target_organization_id: membership.organization_id,
    });
    if (limit.error || limit.data !== true)
      throw new ConnectionError(
        "Please wait before importing another file.",
        429,
      );
    const connection = await requireNangoCapability(
      supabase,
      membership.organization_id,
      id,
      "knowledge_import",
    );
    if (
      connection.provider === "notion" ||
      connection.provider === "confluence"
    ) {
      if (!("sourceId" in body))
        throw new ConnectionError("Choose a saved provider source first.", 400);
      const sourceResult = await createServiceClient()
        .from("integration_sources")
        .select(storedSourceSelect())
        .eq("id", body.sourceId)
        .eq("integration_id", id)
        .eq("organization_id", membership.organization_id)
        .maybeSingle();
      if (sourceResult.error || !sourceResult.data)
        throw new ConnectionError("Selected source not found.", 404);
      const imported = await importProviderSource({
        db: createServiceClient(),
        organizationId: membership.organization_id,
        userId: user.id,
        integrationId: id,
        source: sourceResult.data as unknown as StoredSource,
      });
      return NextResponse.json({
        processId: imported.processId,
        ready: !imported.busy,
        busy: imported.busy ?? false,
      });
    }
    if (connection.provider !== "google_drive" || !("fileId" in body))
      throw new ConnectionError(
        "This connection cannot import knowledge.",
        400,
      );
    const db = createServiceClient();
    const source = await ensureGoogleSelectedSource(
      db,
      connection,
      body.fileId,
    );
    const imported = await importProviderSource({
      db,
      organizationId: membership.organization_id,
      userId: user.id,
      integrationId: id,
      source,
    });
    return NextResponse.json({
      processId: imported.processId,
      ready: !imported.busy,
      busy: imported.busy ?? false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ConnectionError || error instanceof LearningFileError
            ? error.message
            : "Import could not finish. Your approved knowledge is unchanged. Retry this file.",
      },
      { status: error instanceof ConnectionError ? error.status : 400 },
    );
  }
}
