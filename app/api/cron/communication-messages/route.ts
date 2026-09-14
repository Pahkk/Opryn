import { NextResponse } from "next/server";
import { processPendingCommunicationJobs } from "@/lib/communication/processing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const processed = await processPendingCommunicationJobs(20);
  return NextResponse.json({ ok: true, processed });
}
