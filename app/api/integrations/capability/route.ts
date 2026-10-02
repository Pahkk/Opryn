import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { getNangoProvider } from "@/lib/integrations/nango-providers";

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const params = new URL(request.url).searchParams;
  const provider = params.get("provider");
  const capability = params.get("capability");
  if (
    !provider ||
    !["google_drive", "notion", "confluence", "teams"].includes(provider) ||
    !capability ||
    !["knowledge_import", "ask_opryn"].includes(capability)
  )
    return NextResponse.json(
      { error: "This action is not supported." },
      { status: 400 },
    );
  try {
    const configured = getNangoProvider(provider);
    if (!configured.capabilities.includes(capability as never))
      return NextResponse.json(
        { error: "This action is not supported." },
        { status: 400 },
      );
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id,status,auth_platform,capabilities")
      .eq("organization_id", context.membership.organization_id)
      .eq("provider", provider)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      {
        connectionId:
          data?.auth_platform === "nango" &&
          data.status === "connected" &&
          data.capabilities?.includes(capability)
            ? data.id
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "This connection is unavailable right now. Please try again." },
      { status: 503 },
    );
  }
}
