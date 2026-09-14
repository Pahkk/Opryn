import { NextResponse } from "next/server";
import { processPendingExternalLearningJobs } from "@/lib/opryn/mcp/learning";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  )
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const processed = await processPendingExternalLearningJobs();
  return NextResponse.json({ ok: true, processed });
}
