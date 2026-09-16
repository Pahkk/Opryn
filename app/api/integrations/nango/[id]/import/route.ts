import { NextResponse } from "next/server";
import { z } from "zod";
import { extractLearningFile, LearningFileError } from "@/lib/ai/learning-file";
import { getRequestContext } from "@/lib/api";
import {
  driveRequest,
  notionRequest,
  requireNangoCapability,
} from "@/lib/integrations/nango-capabilities";
import { ConnectionError } from "@/lib/integrations/nango";
import { getNangoProvider } from "@/lib/integrations/nango-providers";
import {
  NOTION_PAGE_ID,
  notionMarkdownSchema,
  notionPageSchema,
  notionPageTitle,
} from "@/lib/integrations/notion";
import { LEARNING_FILE_MAX_BYTES } from "@/lib/learning-files";
import { replaceExtractedProcess } from "@/lib/processes";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 180;

type Connection = Awaited<ReturnType<typeof requireNangoCapability>>;
type ImportSource = { file: File; name: string; url: string; description: string };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { supabase, membership, user } = context;
  let processId: string | undefined;
  try {
    const { id } = await params;
    const { fileId } = z
      .object({ fileId: z.string().regex(/^[\w-]{1,200}$/) })
      .strict()
      .parse(await request.json());
    const limit = await supabase.rpc("consume_integration_auth_rate_limit", {
      target_organization_id: membership.organization_id,
    });
    if (limit.error || limit.data !== true)
      throw new ConnectionError("Please wait before importing another source.", 429);
    const connection = await requireNangoCapability(
      supabase,
      membership.organization_id,
      id,
      "knowledge_import",
    );
    const selected = z
      .object({
        selected_files: z.array(z.object({ id: z.string() }).passthrough()).default([]),
      })
      .passthrough()
      .safeParse(connection.configuration);
    if (
      !selected.success ||
      !selected.data.selected_files.some((file) => file.id === fileId)
    )
      throw new ConnectionError("Choose this source before importing it.", 403);

    const source =
      getNangoProvider(connection.provider).nango?.adapter === "notion"
        ? await readNotionSource(connection, fileId)
        : await readGoogleSource(connection, fileId);
    const extracted = await extractLearningFile(source.file);
    await requireNangoCapability(
      supabase,
      membership.organization_id,
      id,
      "knowledge_import",
    );
    const inserted = await supabase
      .from("processes")
      .insert({
        organization_id: membership.organization_id,
        created_by: user.id,
        title: extracted.title,
        description: source.description,
        source_url: source.url,
        source_title: source.name,
        learning_source: "text",
        status: "draft",
      })
      .select("id")
      .single();
    if (inserted.error) throw new Error("Could not save import");
    processId = inserted.data.id;
    await replaceExtractedProcess(
      supabase,
      inserted.data.id,
      membership.organization_id,
      user.id,
      extracted,
    );
    const importedAt = new Date().toISOString();
    const files = selected.data.selected_files.map((file) =>
      file.id === fileId ? { ...file, processId, importedAt } : file,
    );
    await createServiceClient()
      .from("integrations")
      .update({
        last_sync_at: importedAt,
        configuration: {
          ...(connection.configuration as Record<string, unknown>),
          selected_files: files,
        },
      })
      .eq("id", id)
      .eq("organization_id", membership.organization_id)
      .eq("status", "connected");
    return NextResponse.json({ processId, ready: true });
  } catch (error) {
    if (processId)
      await supabase
        .from("processes")
        .delete()
        .eq("id", processId)
        .eq("organization_id", membership.organization_id)
        .eq("created_by", user.id)
        .neq("status", "approved");
    return NextResponse.json(
      {
        error:
          error instanceof ConnectionError || error instanceof LearningFileError
            ? error.message
            : "Import could not finish. Your approved knowledge is unchanged. Retry this source.",
      },
      { status: error instanceof ConnectionError ? error.status : 400 },
    );
  }
}

async function readNotionSource(
  connection: Connection,
  pageId: string,
): Promise<ImportSource> {
  if (!NOTION_PAGE_ID.test(pageId))
    throw new ConnectionError("Choose a valid Notion page.", 400);
  const [pageResponse, markdownResponse] = await Promise.all([
    notionRequest(connection, `pages/${encodeURIComponent(pageId)}`),
    notionRequest(connection, `pages/${encodeURIComponent(pageId)}/markdown`),
  ]);
  const page = notionPageSchema.parse(await pageResponse.json());
  const content = notionMarkdownSchema.parse(await markdownResponse.json());
  if (!content.markdown.trim())
    throw new LearningFileError("That Notion page has no readable content.");
  if (Buffer.byteLength(content.markdown, "utf8") > LEARNING_FILE_MAX_BYTES)
    throw new LearningFileError("Choose a Notion page smaller than 4 MB.");
  const name = notionPageTitle(page);
  const note = content.truncated
    ? " Notion reported that some nested content was unavailable or truncated."
    : "";
  return {
    file: new File([content.markdown], `${safeFilename(name)}.md`, {
      type: "text/markdown",
    }),
    name,
    url: page.url,
    description: `Notion: ${name}. Source last edited: ${page.last_edited_time ?? "not provided"}.${note} Findings require review.`,
  };
}

async function readGoogleSource(
  connection: Connection,
  fileId: string,
): Promise<ImportSource> {
  const metadataResponse = await driveRequest(
    connection,
    `files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink`,
  );
  const metadata = z
    .object({
      id: z.string(),
      name: z.string().max(200),
      mimeType: z.string(),
      modifiedTime: z.string().optional(),
      size: z.string().optional(),
      webViewLink: z.string().url().optional(),
    })
    .parse(await metadataResponse.json());
  if (Number(metadata.size ?? 0) > LEARNING_FILE_MAX_BYTES)
    throw new LearningFileError("Choose a file smaller than 4 MB.");
  const exports: Record<string, { mimeType: string; extension: string }> = {
    "application/vnd.google-apps.document": {
      mimeType: "text/plain",
      extension: ".txt",
    },
    "application/vnd.google-apps.spreadsheet": {
      mimeType: "text/csv",
      extension: ".csv",
    },
    "application/vnd.google-apps.presentation": {
      mimeType: "text/plain",
      extension: ".txt",
    },
  };
  const exportType = exports[metadata.mimeType];
  if (!exportType)
    throw new LearningFileError("Choose a Google Doc, Sheet, or Slides file.");
  const response = await driveRequest(
    connection,
    `files/${fileId}/export?mimeType=${encodeURIComponent(exportType.mimeType)}`,
  );
  const reader = response.body?.getReader();
  if (!reader)
    throw new LearningFileError("The file could not be downloaded.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > LEARNING_FILE_MAX_BYTES) {
      await reader.cancel();
      throw new LearningFileError("Choose a file smaller than 4 MB.");
    }
    chunks.push(value);
  }
  return {
    file: new File(
      [Buffer.concat(chunks)],
      `${metadata.name}${exportType.extension}`,
      { type: exportType.mimeType },
    ),
    name: metadata.name,
    url: metadata.webViewLink ?? `https://drive.google.com/open?id=${fileId}`,
    description: `Google Drive: ${metadata.name}. Source last modified: ${metadata.modifiedTime ?? "not provided"}. Findings require review.`,
  };
}

function safeFilename(value: string) {
  return value.replace(/[^\w .-]+/g, "_").slice(0, 120) || "notion-page";
}
