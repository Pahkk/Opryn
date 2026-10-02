import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
import { embedKnowledge } from "@/lib/ai/services";

export const maxDuration = 120;
const schema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(20).max(12000),
    expectedFirstVersion: z.number().int().positive(),
    expectedSecondVersion: z.number().int().positive(),
    reviewed: z.literal(true),
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json(
      { error: "Open this review in Opryn to continue." },
      { status: 403 },
    );
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "Review the updated rule and both versions." },
      { status: 400 },
    );
  try {
    const conflict = await context.supabase
      .from("knowledge_conflicts")
      .select("id,status")
      .eq("organization_id", context.membership.organization_id)
      .eq("id", id)
      .eq("status", "open")
      .maybeSingle();
    if (conflict.error) throw conflict.error;
    if (!conflict.data)
      return NextResponse.json(
        { error: "This conflict is no longer open." },
        { status: 409 },
      );
    const [embedding] = await embedKnowledge([
      `${parsed.data.title}: ${parsed.data.content}`,
    ]);
    const result = await context.supabase.rpc(
      "replace_company_knowledge_conflict",
      {
        target_org: context.membership.organization_id,
        target_conflict: id,
        expected_first_version: parsed.data.expectedFirstVersion,
        expected_second_version: parsed.data.expectedSecondVersion,
        new_title: parsed.data.title,
        new_content: parsed.data.content,
        prepared_embedding: embedding,
      },
    );
    if (result.error) {
      if (["40001", "23514", "P0002"].includes(result.error.code))
        return NextResponse.json(
          {
            error:
              "The guidance changed or still needs review. Reopen both sources; nothing was replaced.",
          },
          { status: 409 },
        );
      if (result.error.code === "53300")
        return NextResponse.json(
          { error: "Please wait a minute before reviewing more items." },
          { status: 429 },
        );
      throw result.error;
    }
    return NextResponse.json({ ok: true, ...result.data });
  } catch (error) {
    return apiError(
      error,
      "This rule could not be published. Your conflict decision was not applied.",
    );
  }
}
