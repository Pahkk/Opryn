import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
import { rejectCrossOrigin } from "@/lib/request-origin";
import { companyProfileSchema } from "@/lib/activation";
import { getOrganizationPlan } from "@/lib/billing/subscription";

export async function GET(request: Request) {
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  const { supabase, membership, user } = context;
  const org = membership.organization_id;
  const [company, onboarding, settings, sources, answers, billingActivation] = await Promise.all([
    supabase
      .from("organizations")
      .select("id,name,description,industry,employee_count,company_profile")
      .eq("id", org)
      .single(),
    supabase
      .from("organization_onboarding")
      .select(
        "current_step,selected_goals,activation_process_id,onboarding_complete,first_test_answered,billing_required",
      )
      .eq("organization_id", org)
      .single(),
    supabase
      .from("organization_settings")
      .select("settings_revision")
      .eq("organization_id", org)
      .single(),
    supabase
      .from("processes")
      .select("id,title,status")
      .eq("organization_id", org)
      .eq("created_by", user.id)
      .in("status", ["needs_review", "approved"])
      .is("library_archived_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("employee_questions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("asked_by", user.id)
      .eq("answered_by_opryn", true)
      .eq("status", "answered"),
    supabase.from("organization_subscriptions").select("activation_completed_at").eq("organization_id", org).single(),
  ]);
  if ([company, onboarding, settings, sources, answers, billingActivation].some((r) => r.error))
    return NextResponse.json(
      { error: "Setup could not load. Your saved work is safe. Try again." },
      { status: 503 },
    );
  const requested =
    new URL(request.url).searchParams.get("processId") ||
    onboarding.data?.activation_process_id;
  let review = null;
  if (requested) {
    if (!z.string().uuid().safeParse(requested).success)
      return NextResponse.json({ error: "Invalid source." }, { status: 400 });
    const [process, steps, rules, exceptions, questions, roles] =
      await Promise.all([
        supabase
          .from("processes")
          .select(
            "id,title,summary,purpose,status,criticality,assigned_expert_id,source_title,source_provider,learning_source",
          )
          .eq("organization_id", org)
          .eq("id", requested)
          .maybeSingle(),
        supabase
          .from("process_steps")
          .select("id,title,description")
          .eq("organization_id", org)
          .eq("process_id", requested)
          .order("step_order"),
        supabase
          .from("process_rules")
          .select("id,title,text,confidence")
          .eq("organization_id", org)
          .eq("process_id", requested),
        supabase
          .from("process_exceptions")
          .select("text")
          .eq("organization_id", org)
          .eq("process_id", requested),
        supabase
          .from("clarification_questions")
          .select("id,question,answer,suggested_rule")
          .eq("organization_id", org)
          .eq("process_id", requested),
        supabase
          .from("process_role_assignments")
          .select("role_id")
          .eq("organization_id", org)
          .eq("process_id", requested),
      ]);
    if (
      [process, steps, rules, exceptions, questions, roles].some((r) => r.error)
    )
      return NextResponse.json(
        { error: "Findings could not load. Try again." },
        { status: 503 },
      );
    if (!process.data)
      return NextResponse.json(
        { error: "Source not found in this workspace." },
        { status: 404 },
      );
    review = {
      ...process.data,
      expertId: process.data.assigned_expert_id,
      roleId: roles.data?.[0]?.role_id ?? null,
      source:
        process.data.source_title ||
        process.data.learning_source ||
        "Your explanation",
      steps: steps.data ?? [],
      rules: rules.data ?? [],
      exceptions: exceptions.data ?? [],
      clarifications: (questions.data ?? []).map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer || "",
        suggestedRule: q.suggested_rule || "",
      })),
    };
  }
  return NextResponse.json({
    organizationId: org,
    company: { ...company.data, ...company.data?.company_profile },
    revision: settings.data?.settings_revision,
    onboarding: { ...onboarding.data, first_test_answered: Boolean(billingActivation.data?.activation_completed_at || onboarding.data?.first_test_answered) },
    sources: sources.data,
    answered: (answers.count ?? 0) > 0,
    review,
  });
}

const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("company"),
      revision: z.number().int().positive(),
      profile: companyProfileSchema,
      goal: z.string().max(80).optional(),
    })
    .strict(),
  z
    .object({ action: z.literal("source"), processId: z.string().uuid() })
    .strict(),
  z
    .object({ action: z.literal("finish"), questionId: z.string().uuid() })
    .strict(),
  z.object({ action: z.literal("complete") }).strict(),
]);
export async function POST(request: Request) {
  const origin = rejectCrossOrigin(request);
  if (origin) return origin;
  const context = await getRequestContext({
    admin: true,
    allowBillingSetup: true,
  });
  if ("error" in context) return context.error;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review the details and try again." },
      { status: 400 },
    );
  const { supabase, membership, user } = context,
    org = membership.organization_id,
    input = parsed.data;
  if (input.action === "complete") {
    const state = await supabase
      .from("organization_onboarding")
      .select("first_test_answered,billing_required")
      .eq("organization_id", org)
      .single();
    const billing = await getOrganizationPlan(supabase, org);
    if (
      state.error ||
      !billing.activationCompletedAt ||
      !billing.stripeSubscriptionId ||
      !["trialing", "active"].includes(billing.status)
    )
      return NextResponse.json(
        {
          error:
            "Your subscription is still being confirmed. Your setup is saved.",
        },
        { status: 409 },
      );
    const saved = await supabase
      .from("organization_onboarding")
      .update({
        onboarding_complete: true,
        current_step: "complete",
        current_view: "complete",
      })
      .eq("organization_id", org);
    return saved.error
      ? NextResponse.json(
          { error: "Completion couldn't save. Please retry." },
          { status: 503 },
        )
      : NextResponse.json({ saved: true });
  }
  if (input.action === "company") {
    const result = await supabase.rpc("save_company_profile", {
      workspace_id: org,
      expected_revision: input.revision,
      profile: input.profile,
    });
    if (result.error)
      return NextResponse.json(
        {
          error:
            result.error.code === "40001"
              ? "Company profile changed. Reload before saving."
              : "Company profile could not save. Your changes are still here.",
        },
        { status: result.error.code === "40001" ? 409 : 400 },
      );
    if (input.goal) {
      const progress = await supabase
        .from("organization_onboarding")
        .update({
          selected_goals: [input.goal],
          current_step: "teach",
          current_view: "teach",
        })
        .eq("organization_id", org);
      if (progress.error)
        return NextResponse.json(
          {
            error:
              "Company saved, but setup progress could not save. Reload to continue.",
          },
          { status: 503 },
        );
    }
    return NextResponse.json({ revision: result.data });
  }
  if (input.action === "source") {
    const { data, error } = await supabase
      .from("processes")
      .select("id,status")
      .eq("organization_id", org)
      .eq("id", input.processId)
      .maybeSingle();
    if (error || !data)
      return NextResponse.json({ error: "Source not found." }, { status: 404 });
    const saved = await supabase
      .from("organization_onboarding")
      .update({
        activation_process_id: data.id,
        current_step: data.status === "approved" ? "test" : "teach",
        current_view: data.status === "approved" ? "test" : "teach",
      })
      .eq("organization_id", org);
    return saved.error
      ? NextResponse.json(
          { error: "Could not save your review position." },
          { status: 503 },
        )
      : NextResponse.json({ saved: true });
  }
  const { data: state } = await supabase
    .from("organization_onboarding")
    .select("activation_process_id")
    .eq("organization_id", org)
    .single();
  const [approved, answered] = await Promise.all([
    supabase
      .from("processes")
      .select("id")
      .eq("organization_id", org)
      .eq(
        "id",
        state?.activation_process_id ?? "00000000-0000-0000-0000-000000000000",
      )
      .eq("status", "approved")
      .is("library_archived_at", null)
      .maybeSingle(),
    supabase
      .from("employee_questions")
      .select("id")
      .eq("organization_id", org)
      .eq("id", input.questionId)
      .eq("asked_by", user.id)
      .eq("answered_by_opryn", true)
      .eq("status", "answered")
      .limit(1),
  ]);
  if (
    approved.error ||
    answered.error ||
    !approved.data ||
    !answered.data?.length
  )
    return NextResponse.json(
      {
        error:
          "Approve your source and receive an answer from approved knowledge first.",
      },
      { status: 409 },
    );
  const verifiedActivation = await supabase.rpc("record_activation_answer", { workspace_id: org, question_id: input.questionId });
  if (verifiedActivation.error || !verifiedActivation.data) return NextResponse.json({ error: "The sourced answer could not be confirmed. Your work is saved; try again." }, { status: 409 });
  const saved = await supabase
    .from("organization_onboarding")
    .update({
      current_step: "test",
      current_view: "test",
      first_test_answered: true,
      activation_answer_id: input.questionId,
    })
    .eq("organization_id", org);
  return saved.error
    ? NextResponse.json(
        {
          error:
            "Your answer is saved. Setup completion could not save; try again.",
        },
        { status: 503 },
      )
    : NextResponse.json({ saved: true });
}
