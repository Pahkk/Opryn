import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";
const schema = z.object({ status: z.enum(["started", "completed"]) });
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ processId: string }> },
) {
  const context = await getRequestContext();
  if ("error" in context) return context.error;
  const { processId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid training status." },
      { status: 400 },
    );
  const now = new Date().toISOString();
  const { data: assignment, error: readError } = await context.supabase
    .from("training_assignments")
    .select("id,status,started_at")
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .eq("process_id", processId)
    .maybeSingle();
  if (readError)
    return NextResponse.json(
      { error: "Your learning could not be loaded. Please try again." },
      { status: 503 },
    );
  if (!assignment)
    return NextResponse.json(
      { error: "This learning assignment is no longer available." },
      { status: 404 },
    );
  if (assignment.status === "completed") return NextResponse.json({ ok: true });
  const payload =
    parsed.data.status === "completed"
      ? {
          status: "completed",
          started_at: assignment.started_at ?? now,
          completed_at: now,
        }
      : { status: "started", started_at: assignment.started_at ?? now };
  const { data: saved, error } = await context.supabase
    .from("training_assignments")
    .update(payload)
    .eq("organization_id", context.membership.organization_id)
    .eq("user_id", context.user.id)
    .eq("process_id", processId)
    .eq("status", assignment.status)
    .select("id")
    .maybeSingle();
  return error || !saved
    ? NextResponse.json(
        { error: "Unable to update training." },
        { status: 400 },
      )
    : NextResponse.json({ ok: true });
}
