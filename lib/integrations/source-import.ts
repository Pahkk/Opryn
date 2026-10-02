import "server-only";
import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractLearningFile } from "@/lib/ai/learning-file";
import { replaceExtractedProcess } from "@/lib/processes";
import {
  normalizeSelectedSource,
  normalizedSourceText,
  type KnowledgeProvider,
  type SelectableSource,
} from "@/lib/integrations/content-providers";
import { requireNangoCapability } from "@/lib/integrations/nango-capabilities";
import { normalizeGoogleSource } from "./google-source";
import { ConnectionError } from "./nango";

type StoredSource = {
  id: string;
  organization_id: string;
  integration_id: string;
  provider: KnowledgeProvider | "google_drive";
  external_id: string;
  source_type: SelectableSource["sourceType"] | "file";
  title: string;
  parent_context: string | null;
  external_url: string | null;
  modified_at: string | null;
  provider_version: string | null;
  content_hash: string | null;
  process_id: string | null;
  approved_process_id: string | null;
  normalized_content: string | null;
  previous_content: string | null;
  sync_status: string;
  review_status: string;
};

export async function importProviderSource(input: {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  integrationId: string;
  source: StoredSource;
  onlyIfChanged?: boolean;
  onAIWork?: (active: boolean) => Promise<void>;
}) {
  const lease = randomUUID();
  const claimed = await input.db.rpc("claim_source_import", {
    target_org: input.organizationId,
    target_source: input.source.id,
    lease_token: lease,
  });
  if (claimed.error) throw claimed.error;
  if (!claimed.data)
    return { changed: false, processId: input.source.process_id, busy: true };
  try {
    // Read after acquiring the lease; callers may have queued an older snapshot.
    const current = await input.db
      .from("integration_sources")
      .select(storedSourceSelect())
      .eq("organization_id", input.organizationId)
      .eq("id", input.source.id)
      .single();
    if (current.error) throw current.error;
    return await importClaimedSource(
      { ...input, source: current.data as unknown as StoredSource },
      lease,
    );
  } finally {
    const released = await input.db
      .from("integration_sources")
      .update({ import_lease_token: null, import_lease_until: null })
      .eq("id", input.source.id)
      .eq("organization_id", input.organizationId)
      .eq("import_lease_token", lease);
    if (released.error) throw released.error;
  }
}

async function importClaimedSource(
  input: Parameters<typeof importProviderSource>[0],
  lease: string,
) {
  const connection = await requireNangoCapability(
    input.db,
    input.organizationId,
    input.integrationId,
    "knowledge_import",
  );
  if (
    input.source.provider !== "google_drive" &&
    input.source.source_type === "file"
  )
    throw new ConnectionError("This provider cannot import files.", 422);
  const normalized =
    input.source.provider === "google_drive"
      ? await normalizeGoogleSource(connection, input.source.external_id)
      : await normalizeSelectedSource(input.source.provider, connection, {
          externalId: input.source.external_id,
          title: input.source.title,
          sourceType: input.source
            .source_type as SelectableSource["sourceType"],
          parentContext: input.source.parent_context,
          externalUrl: input.source.external_url,
          modifiedAt: input.source.modified_at,
          providerVersion: input.source.provider_version,
        });
  const now = new Date().toISOString();
  if (
    normalized.contentHash === input.source.content_hash &&
    (input.onlyIfChanged || input.source.review_status !== "declined")
  ) {
    const checked = await input.db
      .from("integration_sources")
      .update({
        last_checked_at: now,
        last_successful_check_at: now,
        title: normalized.title,
        parent_context: normalized.parentContext,
        external_url: normalized.externalUrl,
        modified_at: normalized.modifiedAt,
        provider_version: normalized.providerVersion,
        sync_status:
          input.source.review_status === "pending" &&
          input.source.process_id !== input.source.approved_process_id
            ? "changed"
            : "imported",
      })
      .eq("id", input.source.id)
      .eq("organization_id", input.organizationId)
      .eq("import_lease_token", lease);
    if (checked.error) throw checked.error;
    return { changed: false, processId: input.source.process_id, busy: false };
  }

  const text = normalizedSourceText(normalized);
  const file = new File([text], `${safeFilename(normalized.title)}.txt`, {
    type: "text/plain",
  });
  await input.onAIWork?.(true);
  const extracted = await (async () => {
    try {
      return await extractLearningFile(file);
    } finally {
      await input.onAIWork?.(false);
    }
  })();
  await requireNangoCapability(
    input.db,
    input.organizationId,
    input.integrationId,
    "knowledge_import",
  );
  const inserted = await input.db
    .from("processes")
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      title: extracted.title,
      description: `${providerName(normalized.provider)}: ${normalized.title}${normalized.parentContext ? ` · ${normalized.parentContext}` : ""}. ${input.source.content_hash ? "The source changed; this proposed revision requires review." : "Imported findings require review; no historical content snapshot was available for comparison."}`,
      source_url: normalized.externalUrl,
      source_title: normalized.title,
      source_provider: normalized.provider,
      supersedes_process_id: input.source.approved_process_id,
      learning_source: normalized.provider,
      status: "draft",
    })
    .select("id")
    .single();
  if (inserted.error) throw inserted.error;
  let committed = false;
  try {
    await replaceExtractedProcess(
      input.db,
      inserted.data.id,
      input.organizationId,
      input.userId,
      extracted,
    );
    const saved = await input.db
      .from("integration_sources")
      .update({
        title: normalized.title,
        parent_context: normalized.parentContext,
        external_url: normalized.externalUrl,
        modified_at: normalized.modifiedAt,
        provider_version: normalized.providerVersion,
        content_hash: normalized.contentHash,
        metadata: normalized.metadata,
        normalized_content: text.slice(0, 100000),
        previous_content: input.source.normalized_content,
        process_id: inserted.data.id,
        sync_status: input.source.content_hash ? "changed" : "imported",
        review_status: "pending",
        last_checked_at: now,
        last_imported_at: now,
        last_successful_check_at: now,
      })
      .eq("id", input.source.id)
      .eq("organization_id", input.organizationId)
      .eq("import_lease_token", lease)
      .select("id")
      .single();
    if (saved.error) throw saved.error;
    committed = true;
    if (normalized.provider === "google_drive") {
      const recorded = await input.db.rpc("record_google_source_import", {
        target_org: input.organizationId,
        target_integration: input.integrationId,
        external_file: input.source.external_id,
        imported_process: inserted.data.id,
      });
      if (recorded.error) throw recorded.error;
    }
    if (
      input.source.process_id &&
      input.source.process_id !== input.source.approved_process_id
    ) {
      const retiredDraft = await input.db
        .from("processes")
        .update({ library_archived_at: now })
        .eq("organization_id", input.organizationId)
        .eq("id", input.source.process_id)
        .neq("status", "approved");
      if (retiredDraft.error) throw retiredDraft.error;
    }
    const synced = await input.db
      .from("integrations")
      .update({ last_sync_at: now, error_code: null })
      .eq("id", input.integrationId)
      .eq("organization_id", input.organizationId);
    if (synced.error) throw synced.error;
    return {
      changed: Boolean(input.source.content_hash),
      processId: inserted.data.id,
      busy: false,
      prepared: true,
    };
  } catch (error) {
    if (!committed)
      await input.db
        .from("processes")
        .delete()
        .eq("id", inserted.data.id)
        .eq("organization_id", input.organizationId)
        .neq("status", "approved");
    throw error;
  }
}

export function storedSourceSelect() {
  return "id,organization_id,integration_id,provider,external_id,source_type,title,parent_context,external_url,modified_at,provider_version,content_hash,process_id,approved_process_id,normalized_content,previous_content,sync_status,review_status";
}

export type { StoredSource };

function safeFilename(value: string) {
  return (
    value
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "opryn-source"
  );
}
function providerName(provider: StoredSource["provider"]) {
  return provider === "notion"
    ? "Notion"
    : provider === "google_drive"
      ? "Google Workspace"
      : "Confluence";
}

export function sourceFailureStatus(error: unknown) {
  return error instanceof ConnectionError &&
    [401, 403, 404].includes(error.status)
    ? ("unavailable" as const)
    : ("error" as const);
}
