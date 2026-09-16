import { NextResponse } from "next/server";
import { z } from "zod";
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
  notionPageSchema,
  notionSearchSchema,
  notionSelectedPage,
} from "@/lib/integrations/notion";
import { createServiceClient } from "@/lib/supabase/service";

const GOOGLE_FILE_TYPES = {
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.presentation": "Google Slides",
} as const;

const selectionSchema = z
  .object({
    fileIds: z
      .array(z.string().regex(/^[\w-]{1,200}$/))
      .min(1)
      .max(8, "Choose up to 8 files at a time."),
  })
  .strict();
const removalSchema = z
  .object({ fileId: z.string().regex(/^[\w-]{1,200}$/) })
  .strict();

type SelectedFile = {
  id: string;
  name: string;
  mimeType: keyof typeof GOOGLE_FILE_TYPES | "text/markdown";
  type: string;
  modifiedTime?: string;
  webViewLink?: string;
  processId?: string;
  importedAt?: string;
};

function selectedFiles(configuration: unknown): SelectedFile[] {
  const parsed = z
    .object({ selected_files: z.array(z.unknown()).default([]) })
    .passthrough()
    .safeParse(configuration);
  if (!parsed.success) return [];
  return parsed.data.selected_files.flatMap((file) => {
    const result = z
      .object({
        id: z.string(),
        name: z.string(),
        mimeType: z.enum([
          "application/vnd.google-apps.document",
          "application/vnd.google-apps.spreadsheet",
          "application/vnd.google-apps.presentation",
          "text/markdown",
        ]),
        type: z.string(),
        modifiedTime: z.string().optional(),
        webViewLink: z.string().url().optional(),
        processId: z.string().uuid().optional(),
        importedAt: z.string().optional(),
      })
      .safeParse(file);
    return result.success ? [result.data] : [];
  });
}

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
    const files = selectedFiles(connection.configuration);
    if (
      new URL(request.url).searchParams.get("available") === "1" &&
      getNangoProvider(connection.provider).nango?.adapter === "notion"
    ) {
      const response = await notionRequest(connection, "search", {
        method: "POST",
        body: JSON.stringify({
          filter: { property: "object", value: "page" },
          sort: { direction: "descending", timestamp: "last_edited_time" },
          page_size: 100,
        }),
      });
      const search = notionSearchSchema.parse(await response.json());
      const available = search.results.flatMap((result) => {
        const page = notionPageSchema.safeParse(result);
        return page.success ? [notionSelectedPage(page.data)] : [];
      });
      return NextResponse.json(
        { files, available },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { files },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error, "Could not load selected files.");
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
    const { fileIds } = selectionSchema.parse(await request.json());
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const adapter = getNangoProvider(connection.provider).nango?.adapter;
    const files = await Promise.all(
      [...new Set(fileIds)].map(async (fileId): Promise<SelectedFile> => {
        if (adapter === "notion") {
          if (!NOTION_PAGE_ID.test(fileId))
            throw new ConnectionError("Choose valid Notion pages.", 400);
          const response = await notionRequest(
            connection,
            `pages/${encodeURIComponent(fileId)}`,
          );
          return notionSelectedPage(notionPageSchema.parse(await response.json()));
        }
        const response = await driveRequest(
          connection,
          `files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink`,
        );
        const file = z
          .object({
            id: z.string(),
            name: z.string().min(1).max(300),
            mimeType: z.string(),
            modifiedTime: z.string().optional(),
            webViewLink: z.string().url().optional(),
          })
          .parse(await response.json());
        if (!(file.mimeType in GOOGLE_FILE_TYPES))
          throw new ConnectionError(
            "Choose Google Docs, Sheets, or Slides files.",
            400,
          );
        const mimeType = file.mimeType as keyof typeof GOOGLE_FILE_TYPES;
        return { ...file, mimeType, type: GOOGLE_FILE_TYPES[mimeType] };
      }),
    );
    const merged = [...selectedFiles(connection.configuration)];
    for (const file of files) {
      const index = merged.findIndex((item) => item.id === file.id);
      if (index >= 0) merged[index] = { ...merged[index], ...file };
      else merged.push(file);
    }
    const saved = await createServiceClient()
      .from("integrations")
      .update({
        configuration: {
          ...(connection.configuration as Record<string, unknown>),
          selected_files: merged,
        },
      })
      .eq("id", id)
      .eq("organization_id", context.membership.organization_id)
      .eq("status", "connected");
    if (saved.error) throw new Error("Selection could not be saved");
    return NextResponse.json({ files: merged });
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
    const { fileId } = removalSchema.parse(await request.json());
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const files = selectedFiles(connection.configuration).filter(
      (file) => file.id !== fileId,
    );
    const saved = await createServiceClient()
      .from("integrations")
      .update({
        configuration: {
          ...(connection.configuration as Record<string, unknown>),
          selected_files: files,
        },
      })
      .eq("id", id)
      .eq("organization_id", context.membership.organization_id)
      .eq("status", "connected");
    if (saved.error) throw new Error("Selection could not be updated");
    return NextResponse.json({ files });
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
            ? error.issues[0]?.message || "Choose valid sources."
            : fallback,
    },
    { status: error instanceof ConnectionError ? error.status : 400 },
  );
}
