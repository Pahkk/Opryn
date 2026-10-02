import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  driveRequest,
  type requireNangoCapability,
} from "./nango-capabilities";
import { ConnectionError } from "./nango";
import { LEARNING_FILE_MAX_BYTES } from "@/lib/learning-files";
import type { SupabaseClient } from "@supabase/supabase-js";
import { storedSourceSelect, type StoredSource } from "./source-import";

type Connection = Awaited<ReturnType<typeof requireNangoCapability>>;

export async function ensureGoogleSelectedSource(
  db: SupabaseClient,
  connection: Connection,
  fileId: string,
) {
  const selected = z
    .object({
      selected_files: z.array(
        z.object({ id: z.string(), processId: z.string().uuid().optional() }),
      ),
    })
    .passthrough()
    .parse(connection.configuration)
    .selected_files.find((file) => file.id === fileId);
  if (!selected)
    throw new ConnectionError(
      "Choose this file in Google before importing it.",
      403,
    );
  let baseline: string | null = null;
  if (selected.processId) {
    const previous = await db
      .from("processes")
      .select("id,status,source_url")
      .eq("organization_id", connection.organization_id)
      .eq("id", selected.processId)
      .maybeSingle();
    if (previous.error) throw previous.error;
    if (
      previous.data?.status === "approved" &&
      previous.data.source_url?.split(/[/?=&]/).includes(fileId)
    )
      baseline = previous.data.id;
  }
  const inserted = await db
    .from("integration_sources")
    .upsert(
      {
        organization_id: connection.organization_id,
        integration_id: connection.id,
        provider: "google_drive",
        external_id: fileId,
        source_type: "file",
        title: "Selected Google file",
        process_id: baseline,
        approved_process_id: baseline,
      },
      {
        onConflict: "integration_id,external_id,source_type",
        ignoreDuplicates: true,
      },
    );
  if (inserted.error) throw inserted.error;
  const source = await db
    .from("integration_sources")
    .select(storedSourceSelect())
    .eq("organization_id", connection.organization_id)
    .eq("integration_id", connection.id)
    .eq("external_id", fileId)
    .eq("source_type", "file")
    .single();
  if (source.error) throw source.error;
  return source.data as unknown as StoredSource;
}

/** Reuses the selected-file OAuth boundary and existing Nango Drive proxy. */
export async function normalizeGoogleSource(
  connection: Connection,
  fileId: string,
) {
  if (!/^[\w-]{1,200}$/.test(fileId))
    throw new ConnectionError("Choose a valid Google file.", 400);
  const selection = z
    .object({
      selected_files: z.array(z.object({ id: z.string() })).default([]),
    })
    .passthrough()
    .parse(connection.configuration);
  if (!selection.selected_files.some((file) => file.id === fileId))
    throw new ConnectionError(
      "Choose this file in Google before importing it.",
      403,
    );
  const metadata = z
    .object({
      id: z.string(),
      name: z.string().max(200),
      mimeType: z.string(),
      modifiedTime: z.string().optional(),
      size: z.string().optional(),
      webViewLink: z.string().url().optional(),
      version: z.string().optional(),
    })
    .parse(
      await (
        await driveRequest(
          connection,
          `files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webViewLink,version`,
        )
      ).json(),
    );
  const exports: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const mime = exports[metadata.mimeType];
  if (!mime)
    throw new ConnectionError(
      "Choose a Google Doc, Sheet, or Slides file.",
      422,
    );
  if (Number(metadata.size ?? 0) > LEARNING_FILE_MAX_BYTES)
    throw new ConnectionError("Choose a file smaller than 4 MB.", 422);
  const response = await driveRequest(
    connection,
    `files/${fileId}/export?mimeType=${encodeURIComponent(mime)}`,
  );
  const reader = response.body?.getReader();
  if (!reader) throw new ConnectionError("This file could not be read.", 503);
  const buffers: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > LEARNING_FILE_MAX_BYTES) {
      await reader.cancel();
      throw new ConnectionError("Choose a file smaller than 4 MB.", 422);
    }
    buffers.push(value);
  }
  const content = Buffer.concat(buffers)
    .toString("utf8")
    .replace(/\u0000/g, "")
    .trim();
  if (content.length < 20 || content.length > 100000)
    throw new ConnectionError(
      "Choose a smaller file with readable business content.",
      422,
    );
  const sections = [
    { heading: mime === "text/csv" ? "Sheet data (CSV)" : null, content },
  ];
  return {
    provider: "google_drive" as const,
    externalId: fileId,
    sourceType: "file" as const,
    title: metadata.name,
    parentContext: null,
    externalUrl:
      metadata.webViewLink ?? `https://drive.google.com/open?id=${fileId}`,
    modifiedAt: metadata.modifiedTime ?? null,
    providerVersion: metadata.version ?? null,
    sections,
    metadata: { sourceType: metadata.mimeType },
    contentHash: createHash("sha256")
      .update(JSON.stringify(sections))
      .digest("hex"),
  };
}
