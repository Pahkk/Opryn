import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { ConnectionError } from "@/lib/integrations/nango";
import { providerProxyRequest } from "@/lib/integrations/nango-capabilities";

export type KnowledgeProvider = "notion" | "confluence";
export type SelectableSource = {
  externalId: string;
  title: string;
  sourceType: "page" | "database" | "space";
  parentContext: string | null;
  externalUrl: string | null;
  modifiedAt: string | null;
  providerVersion: string | null;
};
export type NormalizedSource = SelectableSource & {
  provider: KnowledgeProvider;
  sections: Array<{ heading: string | null; content: string }>;
  metadata: Record<string, string | number | boolean | null>;
  contentHash: string;
};

type Connection = Awaited<
  ReturnType<typeof import("./nango-capabilities").requireNangoCapability>
>;

const FORBIDDEN_IDENTITY_KEYS = new Set([
  "authorid",
  "ownerid",
  "lastownerid",
  "spaceownerid",
  "accountid",
  "displayname",
  "email",
  "emailaddress",
  "avatar",
  "avatarurl",
  "timezone",
  "createdby",
]);

export function sanitizeProviderMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeProviderMetadata);
  if (!value || typeof value !== "object") return value;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase())) continue;
    clean[key] = sanitizeProviderMetadata(child);
  }
  return clean;
}

export function containsForbiddenIdentity(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenIdentity);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) =>
      FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase()) ||
      containsForbiddenIdentity(child),
  );
}

export async function listSelectableSources(
  provider: KnowledgeProvider,
  connection: Connection,
  query = "",
): Promise<SelectableSource[]> {
  return provider === "notion"
    ? listNotionSources(connection, query)
    : listConfluenceSources(connection, query);
}

export async function resolveSelectableSource(
  provider: KnowledgeProvider,
  connection: Connection,
  externalId: string,
  sourceType: SelectableSource["sourceType"],
): Promise<SelectableSource> {
  const sources = await listSelectableSources(provider, connection, "");
  const direct = sources.find(
    (source) =>
      source.externalId === externalId && source.sourceType === sourceType,
  );
  if (direct) return direct;
  if (provider === "notion")
    return getNotionSource(connection, externalId, sourceType);
  return getConfluenceSource(connection, externalId, sourceType);
}

export async function normalizeSelectedSource(
  provider: KnowledgeProvider,
  connection: Connection,
  source: SelectableSource,
): Promise<NormalizedSource> {
  return provider === "notion"
    ? normalizeNotionSource(connection, source)
    : normalizeConfluenceSource(connection, source);
}

async function providerJson(
  connection: Connection,
  path: string,
  init?: RequestInit,
) {
  const response = await providerProxyRequest(connection, path, init);
  const text = await response.text();
  if (Buffer.byteLength(text) > 4_200_000)
    throw new ConnectionError(
      "This source is too large. Choose a narrower page or space.",
      413,
    );
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ConnectionError("The provider returned unreadable content.", 424);
  }
}

function notionTitle(value: unknown) {
  const record = asRecord(value);
  const properties = asRecord(record.properties);
  for (const property of Object.values(properties)) {
    const item = asRecord(property);
    const rich = Array.isArray(item.title) ? item.title : [];
    const title = rich
      .map((entry) => asRecord(entry).plain_text)
      .filter(isString)
      .join("");
    if (title) return title;
  }
  const title = Array.isArray(record.title) ? record.title : [];
  return (
    title
      .map((entry) => asRecord(entry).plain_text)
      .filter(isString)
      .join("") || "Untitled"
  );
}

async function listNotionSources(connection: Connection, query: string) {
  const payload = await providerJson(connection, "/v1/search", {
    method: "POST",
    headers: { "Notion-Version": "2022-06-28" },
    body: JSON.stringify({
      query: query || undefined,
      page_size: 50,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });
  const results = z
    .object({ results: z.array(z.unknown()).default([]) })
    .parse(payload).results;
  return results.flatMap((raw): SelectableSource[] => {
    const item = asRecord(raw);
    const object = stringValue(item.object);
    if (object !== "page" && object !== "database") return [];
    const id = stringValue(item.id);
    if (!id) return [];
    return [
      {
        externalId: id,
        title: notionTitle(item),
        sourceType: object,
        parentContext: notionParent(item.parent),
        externalUrl: nullableString(item.url),
        modifiedAt: nullableString(item.last_edited_time),
        providerVersion: nullableString(item.last_edited_time),
      },
    ];
  });
}

async function getNotionSource(
  connection: Connection,
  id: string,
  sourceType: SelectableSource["sourceType"],
) {
  if (sourceType === "space")
    throw new ConnectionError("Notion spaces cannot be selected.", 400);
  const payload = await providerJson(
    connection,
    `/v1/${sourceType === "database" ? "databases" : "pages"}/${encodeURIComponent(id)}`,
    {
      headers: { "Notion-Version": "2022-06-28" },
    },
  );
  const item = asRecord(payload);
  return {
    externalId: stringValue(item.id) || id,
    title: notionTitle(item),
    sourceType,
    parentContext: notionParent(item.parent),
    externalUrl: nullableString(item.url),
    modifiedAt: nullableString(item.last_edited_time),
    providerVersion: nullableString(item.last_edited_time),
  } satisfies SelectableSource;
}

async function normalizeNotionSource(
  connection: Connection,
  source: SelectableSource,
) {
  const fresh = await getNotionSource(
    connection,
    source.externalId,
    source.sourceType,
  );
  const sections =
    fresh.sourceType === "database"
      ? await notionDatabaseSections(connection, fresh.externalId)
      : await notionBlockSections(connection, fresh.externalId);
  return finalize("notion", fresh, sections, {
    parent: fresh.parentContext,
    sourceType: fresh.sourceType,
  });
}

async function notionBlockSections(connection: Connection, rootId: string) {
  const lines: string[] = [];
  let cursor: string | undefined;
  let seen = 0;
  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const payload = await providerJson(
      connection,
      `/v1/blocks/${encodeURIComponent(rootId)}/children?${query}`,
      {
        headers: { "Notion-Version": "2022-06-28" },
      },
    );
    const page = z
      .object({
        results: z.array(z.unknown()).default([]),
        has_more: z.boolean().default(false),
        next_cursor: z.string().nullable().optional(),
      })
      .parse(payload);
    for (const raw of page.results) {
      if (++seen > 500)
        throw new ConnectionError(
          "This Notion page is too large. Choose a narrower page.",
          413,
        );
      const line = notionBlockText(raw);
      if (line) lines.push(line);
      const block = asRecord(raw);
      if (block.has_children === true && typeof block.id === "string") {
        const children = await notionBlockSections(connection, block.id);
        lines.push(...children.map((section) => section.content));
      }
    }
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return splitSections(lines);
}

async function notionDatabaseSections(connection: Connection, id: string) {
  const payload = await providerJson(
    connection,
    `/v1/databases/${encodeURIComponent(id)}/query`,
    {
      method: "POST",
      headers: { "Notion-Version": "2022-06-28" },
      body: JSON.stringify({ page_size: 100 }),
    },
  );
  const rows = z
    .object({
      results: z.array(z.unknown()).default([]),
      has_more: z.boolean().default(false),
    })
    .parse(payload);
  if (rows.has_more)
    throw new ConnectionError(
      "This database is large. Select a narrower database view or page.",
      413,
    );
  return rows.results
    .slice(0, 100)
    .map((raw, index) => {
      const row = asRecord(raw);
      const properties = asRecord(row.properties);
      const values = Object.entries(properties).flatMap(([name, value]) => {
        const text = notionPropertyText(value);
        return text ? [`${name}: ${text}`] : [];
      });
      return {
        heading: notionTitle(row) || `Row ${index + 1}`,
        content: values.join("\n"),
      };
    })
    .filter((section) => section.content);
}

function notionBlockText(raw: unknown) {
  const block = asRecord(raw);
  const type = stringValue(block.type);
  const body = asRecord(block[type]);
  if (type === "divider") return "---";
  if (type === "table_row")
    return (Array.isArray(body.cells) ? body.cells : [])
      .map(richText)
      .join(" | ");
  const text = richText(body.rich_text);
  if (!text) return "";
  if (type.startsWith("heading_"))
    return `${"#".repeat(Number(type.at(-1)) || 2)} ${text}`;
  if (type === "bulleted_list_item") return `- ${text}`;
  if (type === "numbered_list_item") return `1. ${text}`;
  if (type === "to_do") return `${body.checked ? "[x]" : "[ ]"} ${text}`;
  if (type === "quote" || type === "callout") return `> ${text}`;
  return text;
}

function notionPropertyText(value: unknown) {
  const item = asRecord(value);
  // People properties are intentionally excluded: page-level attribution is
  // sufficient and Opryn does not persist Notion user profiles.
  for (const key of ["title", "rich_text", "multi_select", "files"]) {
    if (Array.isArray(item[key])) {
      const text = item[key]
        .map((entry) => {
          const record = asRecord(entry);
          return (
            stringValue(record.plain_text) ||
            stringValue(record.name) ||
            stringValue(record.number)
          );
        })
        .filter(Boolean)
        .join(", ");
      if (text) return text;
    }
  }
  for (const key of [
    "number",
    "url",
    "phone_number",
    "checkbox",
    "status",
    "select",
    "date",
    "formula",
  ]) {
    const raw = item[key];
    if (raw === null || raw === undefined) continue;
    if (typeof raw === "object")
      return (
        stringValue(asRecord(raw).name) ||
        stringValue(asRecord(raw).start) ||
        JSON.stringify(sanitizeProviderMetadata(raw))
      );
    return String(raw);
  }
  return "";
}

async function confluenceContext(connection: Connection) {
  const payload = await providerJson(
    connection,
    "/oauth/token/accessible-resources",
  );
  const sites = z
    .array(
      z.object({ id: z.string(), name: z.string(), url: z.string().url() }),
    )
    .parse(payload);
  if (!sites.length)
    throw new ConnectionError("No authorized Confluence site was found.", 424);
  return sites[0];
}

async function listConfluenceSources(connection: Connection, query: string) {
  const site = await confluenceContext(connection);
  const [spacesPayload, pagesPayload] = await Promise.all([
    providerJson(
      connection,
      `/ex/confluence/${encodeURIComponent(site.id)}/wiki/api/v2/spaces?limit=25`,
    ),
    providerJson(
      connection,
      `/ex/confluence/${encodeURIComponent(site.id)}/wiki/api/v2/pages?limit=50&sort=-modified-date`,
    ),
  ]);
  const spaces = z
    .object({ results: z.array(z.unknown()).default([]) })
    .parse(spacesPayload).results;
  const pages = z
    .object({ results: z.array(z.unknown()).default([]) })
    .parse(pagesPayload).results;
  const needle = query.trim().toLowerCase();
  const mapped = [
    ...spaces.flatMap((raw): SelectableSource[] => {
      const item = asRecord(raw);
      const id = stringValue(item.id);
      const title = stringValue(item.name);
      if (!id || !title) return [];
      return [
        {
          externalId: id,
          title,
          sourceType: "space",
          parentContext: site.name,
          externalUrl: confluenceUrl(site.url, asRecord(item._links).webui),
          modifiedAt: null,
          providerVersion: null,
        },
      ];
    }),
    ...pages.flatMap((raw): SelectableSource[] => {
      const item = asRecord(raw);
      const id = stringValue(item.id);
      const title = stringValue(item.title);
      if (!id || !title) return [];
      const version = asRecord(item.version);
      return [
        {
          externalId: id,
          title,
          sourceType: "page",
          parentContext: stringValue(item.spaceId) || site.name,
          externalUrl: confluenceUrl(site.url, asRecord(item._links).webui),
          modifiedAt: nullableString(version.createdAt),
          providerVersion:
            version.number == null
              ? nullableString(item.version)
              : String(version.number),
        },
      ];
    }),
  ];
  return needle
    ? mapped.filter((source) =>
        `${source.title} ${source.parentContext ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : mapped;
}

async function getConfluenceSource(
  connection: Connection,
  id: string,
  sourceType: SelectableSource["sourceType"],
) {
  const site = await confluenceContext(connection);
  if (sourceType === "database")
    throw new ConnectionError("Confluence databases cannot be selected.", 400);
  const payload = await providerJson(
    connection,
    `/ex/confluence/${encodeURIComponent(site.id)}/wiki/api/v2/${sourceType === "space" ? "spaces" : "pages"}/${encodeURIComponent(id)}`,
  );
  const item = asRecord(payload);
  const version = asRecord(item.version);
  return {
    externalId: stringValue(item.id) || id,
    title: stringValue(item.title) || stringValue(item.name) || "Untitled",
    sourceType,
    parentContext:
      sourceType === "space"
        ? site.name
        : stringValue(item.spaceId) || site.name,
    externalUrl: confluenceUrl(site.url, asRecord(item._links).webui),
    modifiedAt: nullableString(version.createdAt),
    providerVersion: version.number == null ? null : String(version.number),
  } satisfies SelectableSource;
}

async function normalizeConfluenceSource(
  connection: Connection,
  source: SelectableSource,
) {
  const site = await confluenceContext(connection);
  const fresh = await getConfluenceSource(
    connection,
    source.externalId,
    source.sourceType,
  );
  const pages =
    fresh.sourceType === "space"
      ? z
          .object({
            results: z.array(z.unknown()).default([]),
            _links: z.object({ next: z.string().optional() }).optional(),
          })
          .parse(
            await providerJson(
              connection,
              `/ex/confluence/${encodeURIComponent(site.id)}/wiki/api/v2/pages?space-id=${encodeURIComponent(fresh.externalId)}&limit=50&body-format=storage`,
            ),
          )
      : {
          results: [
            await providerJson(
              connection,
              `/ex/confluence/${encodeURIComponent(site.id)}/wiki/api/v2/pages/${encodeURIComponent(fresh.externalId)}?body-format=storage`,
            ),
          ],
          _links: undefined,
        };
  if (pages._links?.next)
    throw new ConnectionError(
      "This Confluence space is large. Select specific pages instead.",
      413,
    );
  const sections = pages.results.flatMap((raw) => {
    const page = asRecord(raw);
    const body = asRecord(asRecord(page.body).storage);
    const content = htmlToStructuredText(stringValue(body.value));
    return content
      ? [{ heading: stringValue(page.title) || fresh.title, content }]
      : [];
  });
  const latestVersion = pages.results.reduce<number>(
    (max, raw) =>
      Math.max(max, Number(asRecord(asRecord(raw).version).number ?? 0)),
    0,
  );
  return finalize(
    "confluence",
    {
      ...fresh,
      providerVersion: latestVersion
        ? String(latestVersion)
        : fresh.providerVersion,
    },
    sections,
    {
      site: site.name,
      sourceType: fresh.sourceType,
    },
  );
}

function finalize(
  provider: KnowledgeProvider,
  source: SelectableSource,
  sections: NormalizedSource["sections"],
  metadata: NormalizedSource["metadata"],
): NormalizedSource {
  const cleanSections = sections
    .map((section) => ({
      heading: section.heading?.slice(0, 500) ?? null,
      content: section.content.trim().slice(0, 80_000),
    }))
    .filter((section) => section.content);
  if (!cleanSections.length)
    throw new ConnectionError(
      "This source did not contain readable business content.",
      422,
    );
  const cleanMetadata = sanitizeProviderMetadata(
    metadata,
  ) as NormalizedSource["metadata"];
  if (containsForbiddenIdentity(cleanMetadata))
    throw new ConnectionError("Provider identity metadata was rejected.", 422);
  const contentHash = createHash("sha256")
    .update(JSON.stringify(cleanSections))
    .digest("hex");
  return {
    provider,
    ...source,
    sections: cleanSections,
    metadata: cleanMetadata,
    contentHash,
  };
}

export function normalizedSourceText(
  source: Pick<NormalizedSource, "title" | "parentContext" | "sections">,
) {
  return [
    source.title,
    source.parentContext ? `Location: ${source.parentContext}` : "",
    ...source.sections.map(
      (section) =>
        `${section.heading ? `## ${section.heading}\n` : ""}${section.content}`,
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function splitSections(lines: string[]) {
  const sections: Array<{ heading: string | null; content: string }> = [];
  let current = { heading: null as string | null, lines: [] as string[] };
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)/.exec(line);
    if (match) {
      if (current.lines.length)
        sections.push({
          heading: current.heading,
          content: current.lines.join("\n"),
        });
      current = { heading: match[2], lines: [] };
    } else current.lines.push(line);
  }
  if (current.lines.length)
    sections.push({
      heading: current.heading,
      content: current.lines.join("\n"),
    });
  return sections;
}

function htmlToStructuredText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(
      /<h([1-6])[^>]*>/gi,
      (_all, level) => `\n${"#".repeat(Number(level))} `,
    )
    .replace(/<\/(h[1-6]|p|div|li|tr|table|ac:structured-macro)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<t[dh][^>]*>/gi, " | ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function notionParent(value: unknown) {
  const parent = asRecord(value);
  return (
    nullableString(parent.page_id) ||
    nullableString(parent.database_id) ||
    (parent.workspace ? "Workspace" : null)
  );
}
function richText(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => asRecord(entry).plain_text)
    .filter(isString)
    .join("");
}
function confluenceUrl(base: string, path: unknown) {
  return typeof path === "string" ? new URL(path, base).toString() : base;
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function isString(value: unknown): value is string {
  return typeof value === "string";
}
function stringValue(value: unknown) {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";
}
function nullableString(value: unknown) {
  const result = stringValue(value);
  return result || null;
}
