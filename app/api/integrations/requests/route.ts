import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";

const schema = z.object({
  providerName: z.string().trim().min(2).max(120),
  useCase: z.string().trim().min(8).max(1200),
  followUpEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .optional()
    .or(z.literal("")),
});

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    const input = schema.parse(await request.json());
    const { error } = await context.supabase
      .from("integration_requests")
      .insert({
        organization_id: context.membership.organization_id,
        provider_name: input.providerName,
        use_case: input.useCase,
        follow_up_email: input.followUpEmail || null,
        requested_by: context.user.id,
      });
    if (error) throw error;
    return NextResponse.json({ requested: true });
  } catch (error) {
    return apiError(error, "Opryn couldn't save this integration request.");
  }
}
