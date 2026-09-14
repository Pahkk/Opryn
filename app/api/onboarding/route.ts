import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import {
  fallbackRecommendations,
  prepareRecommendations,
} from "@/lib/recommendations";
import {
  goalSummary,
  ONBOARDING_STEPS,
  ONBOARDING_VIEWS,
  startingKnowledgeAreas,
} from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

const teamSizes = [
  "just_me",
  "2_5",
  "6_10",
  "11_20",
  "21_50",
  "50_plus",
] as const;
const employeeCounts: Record<(typeof teamSizes)[number], number> = {
  just_me: 1,
  "2_5": 3,
  "6_10": 8,
  "11_20": 15,
  "21_50": 35,
  "50_plus": 51,
};
const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  industry: z.string().trim().min(1).max(100),
  teamSize: z.enum(teamSizes),
  ownerRole: z.string().trim().min(1).max(120),
});
const stringList = z.array(z.string().trim().min(1).max(80)).max(30);
const updateSchema = z.object({
  business: createSchema.optional(),
  businessContext: z.string().trim().max(4000).optional(),
  currentStep: z.enum(ONBOARDING_STEPS).optional(),
  currentView: z.enum(ONBOARDING_VIEWS).optional(),
  completedStep: z.enum(ONBOARDING_STEPS).optional(),
  selectedGoals: stringList.optional(),
  knowledgeLocations: stringList.optional(),
  selectedTools: stringList.optional(),
  selectedAiTools: stringList.optional(),
  skippedConnections: stringList.optional(),
  firstQuestion: z.string().trim().max(4000).optional(),
  firstAnswer: z.string().trim().max(10000).optional(),
  firstTestQuestion: z.string().trim().max(4000).optional(),
  firstTestAnswered: z.boolean().optional(),
  teamInvited: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  checklistHidden: z.boolean().optional(),
  event: z
    .enum([
      "goal_selected",
      "knowledge_location_selected",
      "integration_selected",
      "integration_connected",
      "first_test_question",
      "team_invited",
      "onboarding_completed",
      "step_skipped",
    ])
    .optional(),
  eventMetadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Complete the business details before continuing." },
      { status: 400 },
    );
  const { data, error } = await supabase.rpc("create_guided_organization", {
    business_name: parsed.data.name,
    business_industry: parsed.data.industry,
    business_employee_count: employeeCounts[parsed.data.teamSize],
    owner_job_title: parsed.data.ownerRole,
    suggested_areas: startingKnowledgeAreas(parsed.data.industry),
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const organizationId = String(data);
  await Promise.all([
    supabase
      .from("organization_onboarding")
      .update({ current_step: "setup", current_view: "setup" })
      .eq("organization_id", organizationId),
    supabase.from("onboarding_events").insert({
      organization_id: organizationId,
      user_id: userData.user.id,
      event_type: "organization_created",
      metadata: {
        industry: parsed.data.industry,
        team_size: parsed.data.teamSize,
      },
    }),
  ]);
  const response = NextResponse.json({ organizationId });
  response.cookies.set("opryn-organization", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function PATCH(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Opryn couldn't save this setup step." },
      { status: 400 },
    );
  const { membership, supabase, user } = context;
  const organizationId = membership.organization_id;
  const { data: existing } = await supabase
    .from("organization_onboarding")
    .select("completed_steps")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "Onboarding setup was not found." },
      { status: 404 },
    );

  const input = parsed.data;
  const updates: Record<string, unknown> = {};
  if (input.business) {
    const { error: organizationError } = await supabase
      .from("organizations")
      .update({
        name: input.business.name,
        industry: input.business.industry,
        employee_count: employeeCounts[input.business.teamSize],
      })
      .eq("id", organizationId);
    if (organizationError)
      return NextResponse.json(
        { error: "Opryn couldn't update the business details." },
        { status: 400 },
      );
    await supabase
      .from("organization_members")
      .update({ owner_role: input.business.ownerRole })
      .eq("organization_id", organizationId)
      .eq("user_id", user.id);
  }
  if (input.currentStep) {
    updates.current_step = input.currentStep;
    updates.current_view = input.currentView ?? input.currentStep;
  } else if (input.currentView) updates.current_view = input.currentView;
  if (input.completedStep)
    updates.completed_steps = Array.from(
      new Set([...(existing.completed_steps ?? []), input.completedStep]),
    );
  if (input.selectedGoals) {
    updates.selected_goals = input.selectedGoals;
    const { data: organization } = await supabase
      .from("organizations")
      .select("industry")
      .eq("id", organizationId)
      .single();
    updates.suggested_knowledge_areas = startingKnowledgeAreas(
      organization?.industry ?? "",
    );
    await supabase
      .from("organization_discovery")
      .update({
        owner_goal: `Use Opryn to ${goalSummary(input.selectedGoals)}.`,
        ...(input.businessContext
          ? { business_description: input.businessContext }
          : {}),
      })
      .eq("organization_id", organizationId);
  } else if (input.businessContext) {
    await supabase
      .from("organization_discovery")
      .update({ business_description: input.businessContext })
      .eq("organization_id", organizationId);
  }
  if (input.knowledgeLocations)
    updates.knowledge_locations = input.knowledgeLocations;
  if (input.selectedTools) updates.selected_tools = input.selectedTools;
  if (input.selectedAiTools) updates.selected_ai_tools = input.selectedAiTools;
  if (input.skippedConnections)
    updates.skipped_connections = input.skippedConnections;
  if (input.firstQuestion !== undefined)
    updates.first_question = input.firstQuestion;
  if (input.firstAnswer !== undefined) updates.first_answer = input.firstAnswer;
  if (input.firstTestQuestion !== undefined)
    updates.first_test_question = input.firstTestQuestion;
  if (input.firstTestAnswered !== undefined)
    updates.first_test_answered = input.firstTestAnswered;
  if (input.teamInvited !== undefined) updates.team_invited = input.teamInvited;
  if (input.onboardingComplete !== undefined) {
    updates.onboarding_complete = input.onboardingComplete;
    if (input.onboardingComplete) updates.current_step = "complete";
  }
  if (input.checklistHidden !== undefined)
    updates.checklist_hidden = input.checklistHidden;
  const { error } = await supabase
    .from("organization_onboarding")
    .update(updates)
    .eq("organization_id", organizationId);
  if (error)
    return NextResponse.json(
      { error: "Opryn couldn't save this setup step." },
      { status: 400 },
    );
  if (input.onboardingComplete) await ensureStartingRecommendations(context);
  if (input.event)
    await supabase.from("onboarding_events").insert({
      organization_id: organizationId,
      user_id: user.id,
      event_type: input.event,
      metadata: input.eventMetadata ?? {},
    });
  return NextResponse.json({ ok: true });
}

async function ensureStartingRecommendations(
  context: Exclude<
    Awaited<ReturnType<typeof getRequestContext>>,
    { error: NextResponse }
  >,
) {
  const { membership, supabase, user } = context;
  const organizationId = membership.organization_id;
  const [
    recommendationCount,
    discoveryResult,
    onboardingResult,
    organizationResult,
  ] = await Promise.all([
    supabase
      .from("process_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("organization_discovery")
      .select("*")
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("organization_onboarding")
      .select("first_question")
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("organizations")
      .select("industry,employee_count")
      .eq("id", organizationId)
      .single(),
  ]);
  if (recommendationCount.count) return;
  const discovery = discoveryResult.data;
  const organization = organizationResult.data;
  const onboarding = onboardingResult.data;
  if (!discovery || !organization || !onboarding) return;
  const input = {
    industry: organization.industry,
    employeeCount: organization.employee_count,
    businessDescription: discovery.business_description,
    repeatedWork: discovery.repeated_work,
    hardestToHandoff: discovery.hardest_to_handoff,
    commonQuestions: onboarding.first_question ?? discovery.common_questions,
    ownerGoal: discovery.owner_goal,
  };
  const recommendations = prepareRecommendations(
    fallbackRecommendations(input),
    input,
  );
  await supabase.from("process_recommendations").insert(
    recommendations.map((recommendation) => ({
      organization_id: organizationId,
      created_by: user.id,
      ...recommendation,
    })),
  );
}
