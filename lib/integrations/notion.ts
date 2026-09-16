import { z } from "zod";

export const NOTION_VERSION = "2026-03-11";
export const NOTION_PAGE_ID = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const richTextSchema = z.object({ plain_text: z.string() }).passthrough();
const titlePropertySchema = z
  .object({ type: z.literal("title"), title: z.array(richTextSchema) })
  .passthrough();

export const notionPageSchema = z
  .object({
    object: z.literal("page"),
    id: z.string().regex(NOTION_PAGE_ID),
    url: z.string().url(),
    last_edited_time: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).default({}),
  })
  .passthrough();

export const notionSearchSchema = z
  .object({ results: z.array(z.unknown()) })
  .passthrough();

export const notionMarkdownSchema = z
  .object({
    object: z.literal("page_markdown"),
    markdown: z.string(),
    truncated: z.boolean().default(false),
  })
  .passthrough();

export function notionPageTitle(page: z.infer<typeof notionPageSchema>) {
  for (const property of Object.values(page.properties)) {
    const parsed = titlePropertySchema.safeParse(property);
    if (!parsed.success) continue;
    const title = parsed.data.title.map((part) => part.plain_text).join("").trim();
    if (title) return title.slice(0, 300);
  }
  return "Untitled Notion page";
}

export function notionSelectedPage(page: z.infer<typeof notionPageSchema>) {
  return {
    id: page.id,
    name: notionPageTitle(page),
    mimeType: "text/markdown" as const,
    type: "Notion page",
    modifiedTime: page.last_edited_time,
    webViewLink: page.url,
  };
}
