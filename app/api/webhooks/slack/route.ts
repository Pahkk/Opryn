import { after } from "next/server";
import { getCommunicationBot } from "@/lib/communication/bot";
import { processPendingCommunicationJobs } from "@/lib/communication/processing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tasks: Promise<unknown>[] = [];
  const response = await getCommunicationBot().webhooks.slack(request, {
    waitUntil(task) {
      tasks.push(task);
    },
  });
  after(async () => {
    await Promise.allSettled(tasks);
    await processPendingCommunicationJobs(8);
  });
  return response;
}
