import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";

const schema = z.object({
  intent: z
    .object({
      provider: z.enum(["chatgpt", "claude"]),
      type: z.enum(["business", "process", "topic"]),
      name: z.string().max(200),
      stage: z.enum(["type", "name", "request", "waiting"]),
      since: z.iso.datetime().optional(),
    })
    .nullable()
    .optional(),
  event: z
    .enum([
      "learning_source_opened",
      "learning_type_selected",
      "external_ai_learn_started",
      "learning_review_opened",
      "first_suggested_question_used",
    ])
    .optional(),
});

export async function GET() {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { data, error } = await context.supabase
    .from("onboarding_learning_sessions")
    .select("intent")
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Your saved learning request couldn't be loaded." },
      { status: 500 },
    );
  const { data: imports } = await context.supabase
    .from("processes")
    .select("id,title,status")
    .eq("organization_id", context.membership.organization_id)
    .eq("created_by", context.user.id)
    .in("learning_source", ["text", "google_drive"])
    .in("status", ["approved", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(6);
  return NextResponse.json({
    intent: data?.intent ?? null,
    imports: imports ?? [],
  });
}

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a learning source to continue." },
      { status: 400 },
    );
  if (parsed.data.intent !== undefined) {
    const { error } = await context.supabase
      .from("onboarding_learning_sessions")
      .upsert({
        organization_id: context.membership.organization_id,
        user_id: context.user.id,
        intent: parsed.data.intent,
        updated_at: new Date().toISOString(),
      });
    if (error)
      return NextResponse.json(
        { error: "Your learning request couldn't be saved." },
        { status: 500 },
      );
  }
  if (parsed.data.event)
    await context.supabase.from("onboarding_events").insert({
      organization_id: context.membership.organization_id,
      user_id: context.user.id,
      event_type: parsed.data.event,
      metadata: {
        provider: parsed.data.intent?.provider,
        learning_type: parsed.data.intent?.type,
      },
    });
  return NextResponse.json({ saved: true });
}
