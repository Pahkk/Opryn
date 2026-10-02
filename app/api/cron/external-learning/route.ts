import { processTrainingEvaluations } from "@/lib/training/evaluations";
import { NextResponse } from "next/server";
import { processPendingExternalLearningJobs } from "@/lib/opryn/mcp/learning";
import { processPendingGapRechecks } from "@/lib/opryn/knowledge/recheck-runner";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Independent workers: a learning failure must not prevent gap recovery.
  const [learning, gaps, training] = await Promise.allSettled([
    processPendingExternalLearningJobs(),
    processPendingGapRechecks(createServiceClient()),
    processTrainingEvaluations(createServiceClient()),
  ]);
  const ok =
    learning.status === "fulfilled" &&
    gaps.status === "fulfilled" &&
    training.status === "fulfilled";
  return NextResponse.json(
    {
      ok,
      processed: learning.status === "fulfilled" ? learning.value : null,
      trainingEvaluations:
        training.status === "fulfilled" ? training.value : null,
      gapRechecks: gaps.status === "fulfilled" ? gaps.value : null,
    },
    { status: ok ? 200 : 500 },
  );
}
