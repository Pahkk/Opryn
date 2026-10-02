import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const schema = z.object({
  processId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).max(200),
});

export async function PUT(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Choose a process and valid team members." },
      { status: 400 },
    );

  const { supabase, membership } = context;
  const organizationId = membership.organization_id;
  const requestedUserIds = [...new Set(parsed.data.userIds)];

  try {
    const [{ data: process }, { data: members }, { data: existing }] =
      await Promise.all([
        supabase
          .from("processes")
          .select("id")
          .eq("id", parsed.data.processId)
          .eq("organization_id", organizationId)
          .eq("status", "approved")
          .maybeSingle(),
        requestedUserIds.length
          ? supabase
              .from("organization_members")
              .select("user_id")
              .eq("organization_id", organizationId)
              .in("user_id", requestedUserIds)
          : Promise.resolve({ data: [] as Array<{ user_id: string }> }),
        supabase
          .from("training_assignments")
          .select("id,user_id,status,origin_role_id")
          .eq("organization_id", organizationId)
          .eq("process_id", parsed.data.processId),
      ]);

    if (!process)
      return NextResponse.json(
        { error: "Only approved workspace processes can be assigned." },
        { status: 404 },
      );
    if ((members ?? []).length !== requestedUserIds.length)
      return NextResponse.json(
        { error: "One or more selected people are not in this workspace." },
        { status: 400 },
      );

    const existingIds = new Set((existing ?? []).map((item) => item.user_id));
    const requestedIds = new Set(requestedUserIds);
    const additions = requestedUserIds.filter((id) => !existingIds.has(id));
    const removals = (existing ?? []).filter(
      (item) => !requestedIds.has(item.user_id) && !item.origin_role_id,
    );

    if (additions.length) {
      const { error } = await supabase.from("training_assignments").insert(
        additions.map((userId) => ({
          organization_id: organizationId,
          user_id: userId,
          process_id: parsed.data.processId,
          status: "assigned",
        })),
      );
      if (error) throw error;
    }
    if (removals.length) {
      const { error } = await supabase
        .from("training_assignments")
        .delete()
        .eq("organization_id", organizationId)
        .eq("process_id", parsed.data.processId)
        .in(
          "id",
          removals.map((item) => item.id),
        );
      if (error) throw error;
    }

    const { data: assignments, error } = await supabase
      .from("training_assignments")
      .select("id,user_id,status,started_at,completed_at")
      .eq("organization_id", organizationId)
      .eq("process_id", parsed.data.processId);
    if (error) throw error;
    return NextResponse.json({ assignments });
  } catch (error) {
    return apiError(error, "Unable to save these training assignments.");
  }
}
