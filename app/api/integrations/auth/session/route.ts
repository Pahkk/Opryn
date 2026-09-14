import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, getRequestContext } from "@/lib/api";
import { saveCredentialIntegration } from "@/lib/integrations/service";

const schema = z.object({
  provider: z.string().trim().min(1).max(80),
  credentials: z.record(z.string().max(80), z.string().max(20_000)),
});

export async function POST(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    const input = schema.parse(await request.json());
    const { data: rateAllowed } = await context.supabase.rpc(
      "consume_integration_auth_rate_limit",
      {
        target_organization_id: context.membership.organization_id,
      },
    );
    if (rateAllowed === false)
      return NextResponse.json(
        {
          error:
            "Too many connection attempts. Wait a few minutes and try again.",
        },
        { status: 429 },
      );
    const connection = await saveCredentialIntegration({
      supabase: context.supabase,
      providerId: input.provider,
      credentials: input.credentials,
      organizationId: context.membership.organization_id,
      userId: context.user.id,
    });
    return NextResponse.json({ connected: true, ...connection });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check the connection details and try again." },
        { status: 400 },
      );
    return apiError(error, "Opryn couldn't save this connection.");
  }
}
