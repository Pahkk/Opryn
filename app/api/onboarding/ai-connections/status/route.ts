import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { conversationIntentSchema } from "@/lib/onboarding/conversation-learning";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import { providerLearningCapabilities } from "@/lib/onboarding/provider-capabilities";

const querySchema = z.enum(["chatgpt", "claude"]);

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;

  const provider = querySchema.safeParse(
    new URL(request.url).searchParams.get("provider"),
  );
  if (!provider.success)
    return NextResponse.json(
      { error: "Choose ChatGPT or Claude." },
      { status: 400 },
    );

  const query = z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      since: z.iso.datetime().optional(),
      requestId: z.uuid().optional(),
    })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success)
    return NextResponse.json(
      { error: "This learning request is invalid. Prepare a new request." },
      { status: 400 },
    );
  let handoff: ReturnType<typeof conversationIntentSchema.parse> | null = null;
  if (query.data.requestId) {
    const { data, error } = await context.supabase
      .from("onboarding_learning_sessions")
      .select("intent")
      .eq("organization_id", context.membership.organization_id)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (error)
      return NextResponse.json(
        { error: "Couldn't check your learning request." },
        { status: 500 },
      );
    const parsed = conversationIntentSchema.safeParse(data?.intent);
    if (
      !parsed.success ||
      parsed.data.requestId !== query.data.requestId ||
      parsed.data.provider !== provider.data
    )
      return NextResponse.json(
        { error: "Prepare a new learning request." },
        { status: 400 },
      );
    handoff = parsed.data;
  }
  let learningQuery = context.supabase
    .from("external_learning_jobs")
    .select(
      "id,name,status,result_summary,process_id,created_at,updated_at,last_requested_at",
    )
    .eq("organization_id", context.membership.organization_id)
    .eq("created_by", context.user.id)
    .eq("client_kind", provider.data);
  // Filter before limit: an unrelated newer job must not hide the requested one.
  if (handoff?.jobId) learningQuery = learningQuery.eq("id", handoff.jobId);
  else if (query.data.name && !handoff)
    learningQuery = learningQuery.eq("name", query.data.name);
  if (query.data.since)
    learningQuery = learningQuery.gte("last_requested_at", query.data.since);

  const [grantsResult, learningResult, subscription] = await Promise.all([
    context.supabase
      .from("mcp_oauth_grants")
      .select("id,scopes,last_used_at")
      .eq("organization_id", context.membership.organization_id)
      .eq("user_id", context.user.id)
      .eq("client_kind", provider.data)
      .is("revoked_at", null)
      .order("authorized_at", { ascending: false })
      .limit(5),
    learningQuery
      .order("last_requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getOrganizationPlan(context.supabase, context.membership.organization_id),
  ]);

  if (grantsResult.error || learningResult.error)
    return NextResponse.json(
      { error: "Opryn couldn't check this connection." },
      { status: 500 },
    );

  const processId = learningResult.data?.process_id;
  const [processResult, rulesResult] = processId
    ? await Promise.all([
        context.supabase
          .from("processes")
          .select("title,status")
          .eq("organization_id", context.membership.organization_id)
          .eq("id", processId)
          .maybeSingle(),
        context.supabase
          .from("process_rules")
          .select("title")
          .eq("organization_id", context.membership.organization_id)
          .eq("process_id", processId)
          .limit(5),
      ])
    : [{ data: null }, { data: [] }];
  const findings = (rulesResult.data ?? []).map((rule) => rule.title as string);
  if (processResult.data?.title) findings.unshift(processResult.data.title);

  const expired = !!(
    handoff?.expiresAt &&
    !handoff.jobId &&
    Date.parse(handoff.expiresAt) <= Date.now()
  );
  return NextResponse.json({
    entitlement: {
      feature: "ai_conversation_learning",
      enabled: hasFeature(subscription.plan, "ai_conversation_learning"),
    },
    providerCapability: {
      status: learningResult.data ? "previously_invoked" : "unverified",
      ...providerLearningCapabilities[provider.data],
    },
    requiresConfirmation: !!(
      !expired &&
      handoff &&
      !handoff.jobId &&
      learningResult.data
    ),
    requestExpired: !!(
      handoff?.expiresAt &&
      !handoff.jobId &&
      Date.parse(handoff.expiresAt) <= Date.now()
    ),
    provider: provider.data,
    connected: Boolean(grantsResult.data?.length),
    learningEnabled: Boolean(
      grantsResult.data?.some((grant) =>
        (grant.scopes ?? []).includes("opryn.learning.create"),
      ),
    ),
    latestLearning:
      !expired && learningResult.data
        ? {
            id: learningResult.data.id,
            createdAt: learningResult.data.created_at,
            requestedAt: learningResult.data.last_requested_at,
            name: learningResult.data.name,
            status: learningResult.data.status,
            summary: learningResult.data.result_summary,
            processId: learningResult.data.process_id,
            findings,
            approved: processResult.data?.status === "approved",
            questions:
              processResult.data?.status === "approved"
                ? findings
                    .slice(0, 3)
                    .map((title) => `What should I know about ${title}?`)
                : [],
            error:
              learningResult.data.status === "failed"
                ? "Opryn couldn't organize this conversation. Try sending it again."
                : null,
            updatedAt: learningResult.data.updated_at,
          }
        : null,
  });
}
