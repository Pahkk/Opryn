import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import {
  conversationIntentSchema,
  type ConversationIntent,
} from "@/lib/onboarding/conversation-learning";

const schema = z.object({
  intent: z
    .lazy(() => conversationIntentSchema)
    .nullable()
    .optional(),
  event: z
    .enum([
      "learning_source_opened",
      "learning_type_selected",
      "external_ai_learn_started",
      "learning_review_opened",
      "first_suggested_question_used",
      "integration_selected",
      "integration_connected",
    ])
    .optional(),
  provider: z.enum(["chatgpt", "claude"]).optional(),
  metric: z
    .enum([
      "chatgpt_connect_started",
      "chatgpt_connected",
      "chatgpt_learn_started",
      "claude_connect_started",
      "claude_connected",
      "claude_learn_started",
      "ai_source_review_started",
      "ai_learning_handoff_created",
      "provider_opened",
      "instruction_copied",
      "learning_review_started",
      "premium_ai_learning_viewed",
      "premium_ai_learning_upgrade_started",
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
  let savedIntent: ConversationIntent | null | undefined =
    parsed.data.intent?.stage === "waiting"
      ? { ...parsed.data.intent, since: new Date().toISOString() }
      : parsed.data.intent
        ? {
            ...parsed.data.intent,
            requestId: undefined,
            expiresAt: undefined,
            jobId: undefined,
            since: undefined,
          }
        : parsed.data.intent;
  if (savedIntent && ["request", "waiting"].includes(savedIntent.stage)) {
    const subscription = await getOrganizationPlan(
      context.supabase,
      context.membership.organization_id,
    );
    if (!hasFeature(subscription.plan, "ai_conversation_learning"))
      return NextResponse.json(
        {
          error: "Conversation learning is available on Opryn Pro.",
          code: "premium_required",
        },
        { status: 403 },
      );
    const { data, error } = await context.supabase
      .from("onboarding_learning_sessions")
      .select("intent")
      .eq("organization_id", context.membership.organization_id)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { error: "Your learning request couldn't be prepared." },
        { status: 500 },
      );
    const previous = conversationIntentSchema.safeParse(data?.intent);
    const reusable =
      previous.success &&
      previous.data.requestId &&
      previous.data.expiresAt &&
      Date.parse(previous.data.expiresAt) > Date.now() &&
      previous.data.provider === savedIntent.provider &&
      previous.data.name === savedIntent.name &&
      previous.data.type === savedIntent.type;
    savedIntent = {
      ...savedIntent,
      requestId: reusable ? previous.data.requestId : randomUUID(),
      expiresAt: reusable
        ? previous.data.expiresAt
        : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      jobId: reusable ? previous.data.jobId : undefined,
      since:
        reusable && previous.data.since
          ? previous.data.since
          : savedIntent.since,
    };
  }
  if (savedIntent !== undefined) {
    const { error } = await context.supabase
      .from("onboarding_learning_sessions")
      .upsert({
        organization_id: context.membership.organization_id,
        user_id: context.user.id,
        intent: savedIntent,
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
        provider: parsed.data.intent?.provider ?? parsed.data.provider,
        learning_type: parsed.data.intent?.type,
        metric: parsed.data.metric,
      },
    });
  return NextResponse.json({
    saved: true,
    ...(savedIntent !== undefined ? { intent: savedIntent } : {}),
  });
}
