import { NextResponse, after } from "next/server";
import { processTrainingEvaluations } from "@/lib/training/evaluations";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { createServiceClient } from "@/lib/supabase/service";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
import {
  compareTestExpectation,
  testCompanyAnswer,
} from "@/lib/opryn/knowledge/testbench";

export const maxDuration = 120;
const outcome = z.enum([
  "answered",
  "unknown",
  "conflict",
  "needs_clarification",
  "restricted",
]);
const schema = z.object({
  action: z.enum(["run", "save", "rerun", "delete"]),
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  question: z.string().trim().min(3).max(4000).optional(),
  context: scopeContextSchema.default({}),
  consumer: z
    .enum(["employee", "new_hire", "connected_ai", "support_bot", "call_agent"])
    .default("employee"),
  actorId: z.uuid().optional(),
  connectionId: z.uuid().optional(),
  expectedOutcome: outcome.default("answered"),
  expectedBehavior: z.string().trim().max(2000).default(""),
  expectedKnowledgeIds: z.array(z.uuid()).max(20).default([]),
});
async function expectedVersions(
  service: ReturnType<typeof createServiceClient>,
  org: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await service
    .from("knowledge_chunks")
    .select("id,current_version")
    .eq("organization_id", org)
    .in("id", ids);
  if (rows.error) throw rows.error;
  return (rows.data ?? []).map((k) => ({
    id: k.id,
    version: k.current_version,
  }));
}
export async function GET(request: Request) {
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const org = ctx.membership.organization_id;
  const testId = new URL(request.url).searchParams.get("testId");
  if (testId && !z.uuid().safeParse(testId).success)
    return NextResponse.json({ error: "Invalid test." }, { status: 400 });
  let query = ctx.supabase
    .from("knowledge_test_cases")
    .select("*")
    .eq("organization_id", org)
    .is("retired_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (testId) query = query.eq("id", testId);
  const result = await query;
  if (result.error)
    return apiError(result.error, "Saved tests could not be loaded.");
  const ids = [
    ...new Set(
      (result.data ?? []).flatMap((r) => [
        ...(r.linked_knowledge_ids ?? []),
        ...(r.expected_knowledge_ids ?? []),
      ]),
    ),
  ] as string[];
  const versions = ids.length
    ? await ctx.supabase
        .from("knowledge_chunks")
        .select("id,current_version,approved,library_archived_at")
        .eq("organization_id", org)
        .in("id", ids)
    : { data: [], error: null };
  if (versions.error) return apiError(versions.error);
  return NextResponse.json({
    tests: (result.data ?? []).map((test) => ({
      ...test,
      needsRerun:
        test.needs_rerun ||
        !test.last_run_at ||
        [
          ...(test.last_result?.sources ?? []),
          ...(test.last_result?.expectedSources ?? []),
        ].some((s: { id: string; version: number }) => {
          const current = versions.data?.find((k) => k.id === s.id);
          return (
            !current ||
            !current.approved ||
            current.library_archived_at ||
            current.current_version !== s.version
          );
        }),
    })),
  });
}
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return NextResponse.json(
      { error: "This action must start in Opryn." },
      { status: 403 },
    );
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Check the test details." },
      { status: 400 },
    );
  const body = parsed.data,
    org = ctx.membership.organization_id,
    service = createServiceClient();
  try {
    if (body.action === "delete") {
      if (!body.id)
        return NextResponse.json(
          { error: "Choose a saved test." },
          { status: 400 },
        );
      const result = await service
        .from("knowledge_test_cases")
        .update({ retired_at: new Date().toISOString() })
        .eq("organization_id", org)
        .eq("id", body.id)
        .select("id")
        .maybeSingle();
      if (result.error) throw result.error;
      return NextResponse.json(
        { ok: !!result.data },
        { status: result.data ? 200 : 404 },
      );
    }
    if (body.action === "rerun") {
      if (!body.id)
        return NextResponse.json(
          { error: "Choose a saved test." },
          { status: 400 },
        );
      const saved = await service
        .from("knowledge_test_cases")
        .select("*")
        .eq("organization_id", org)
        .eq("id", body.id)
        .maybeSingle();
      if (saved.error) throw saved.error;
      if (!saved.data)
        return NextResponse.json({ error: "Test not found." }, { status: 404 });
      const test = saved.data;
      if (test.retired_at)
        return NextResponse.json(
          { error: "This test was retired." },
          { status: 409 },
        );
      if (test.connection_id) {
        const queued = await ctx.supabase.rpc("queue_agent_training_test", {
          target_org: org,
          target_test: test.id,
        });
        if (queued.error) throw queued.error;
        after(() => processTrainingEvaluations(service, 1));
        return NextResponse.json(
          { queued: true, id: test.id },
          { status: 202 },
        );
      }

      const result = await testCompanyAnswer(service, org, {
        question: test.question,
        context: scopeContextSchema.parse(test.context),
        consumer: test.consumer,
        actorId: test.actor_id ?? undefined,
        connectionId: test.connection_id ?? undefined,
      });
      const comparison = compareTestExpectation(
        result,
        test.expected_outcome,
        test.expected_knowledge_ids,
      );
      const expectedSources = await expectedVersions(
        service,
        org,
        test.expected_knowledge_ids,
      );
      const write = await service
        .from("knowledge_test_cases")
        .update({
          last_run_at: result.testedAt,
          last_result: { ...result, comparison, expectedSources },
          linked_knowledge_ids: result.sources.map((s) => s.id),
        })
        .eq("organization_id", org)
        .eq("id", test.id);
      if (write.error) throw write.error;
      return NextResponse.json({ result, comparison });
    }
    if (!body.question || (body.action === "save" && !body.title))
      return NextResponse.json(
        { error: "Add the question and test title." },
        { status: 400 },
      );
    const teamInput = ["employee", "new_hire"].includes(body.consumer);
    if (teamInput ? !body.actorId : !body.connectionId)
      return NextResponse.json(
        { error: "Choose actual member or connection access." },
        { status: 400 },
      );
    if (body.expectedKnowledgeIds.length) {
      const knowledge = await service
        .from("knowledge_chunks")
        .select("id")
        .eq("organization_id", org)
        .in("id", body.expectedKnowledgeIds);
      if (knowledge.error) throw knowledge.error;
      if (knowledge.data?.length !== new Set(body.expectedKnowledgeIds).size)
        return NextResponse.json(
          { error: "Expected sources must belong to this workspace." },
          { status: 400 },
        );
    }
    if (body.action === "save" && !teamInput) {
      const c = await service
        .from("external_ai_connections")
        .select("id,status")
        .eq("organization_id", org)
        .eq("id", body.connectionId!)
        .maybeSingle();
      if (c.error) throw c.error;
      if (c.data?.status !== "active")
        return NextResponse.json(
          { error: "Choose an active workspace agent." },
          { status: 400 },
        );
      const created = await service
        .from("knowledge_test_cases")
        .insert({
          organization_id: org,
          title: body.title,
          question: body.question,
          context: body.context,
          consumer: body.consumer,
          connection_id: body.connectionId,
          expected_outcome: body.expectedOutcome,
          expected_behavior: body.expectedBehavior,
          expected_knowledge_ids: body.expectedKnowledgeIds,
          created_by: ctx.user.id,
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      const queued = await ctx.supabase.rpc("queue_agent_training_test", {
        target_org: org,
        target_test: created.data.id,
      });
      if (queued.error) throw queued.error;
      after(() => processTrainingEvaluations(service, 1));
      return NextResponse.json(
        { queued: true, id: created.data.id },
        { status: 202 },
      );
    }
    const input = {
      question: body.question,
      context: body.context,
      consumer: body.consumer,
      actorId: body.actorId,
      connectionId: body.connectionId,
    };
    const result = await testCompanyAnswer(service, org, input);
    const comparison = compareTestExpectation(
      result,
      body.expectedOutcome,
      body.expectedKnowledgeIds,
    );
    if (body.action === "save") {
      const member = body.actorId
        ? await service
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", org)
            .eq("user_id", body.actorId)
            .maybeSingle()
        : { data: null, error: null };
      const connection = body.connectionId
        ? await service
            .from("external_ai_connections")
            .select("id")
            .eq("organization_id", org)
            .eq("id", body.connectionId)
            .maybeSingle()
        : { data: null, error: null };
      if (member.error || connection.error)
        throw member.error ?? connection.error;
      const team = ["employee", "new_hire"].includes(body.consumer);
      if (team ? !member.data : !connection.data)
        return NextResponse.json(
          { error: "Choose an actual member or connection in this workspace." },
          { status: 400 },
        );
      const expectedSources = await expectedVersions(
        service,
        org,
        body.expectedKnowledgeIds,
      );
      const write = await service
        .from("knowledge_test_cases")
        .insert({
          organization_id: org,
          title: body.title,
          question: body.question,
          context: body.context,
          consumer: body.consumer,
          actor_id: team ? body.actorId : null,
          connection_id: team ? null : body.connectionId,
          expected_outcome: body.expectedOutcome,
          expected_behavior: body.expectedBehavior,
          expected_knowledge_ids: body.expectedKnowledgeIds,
          linked_knowledge_ids: result.sources.map((s) => s.id),
          created_by: ctx.user.id,
          last_run_at: result.testedAt,
          last_result: { ...result, comparison, expectedSources },
        })
        .select("id")
        .single();
      if (write.error) throw write.error;
      return NextResponse.json({ result, comparison, id: write.data.id });
    }
    return NextResponse.json({ result, comparison });
  } catch (error) {
    return apiError(
      error,
      "The test could not finish. No external message was sent.",
    );
  }
}
