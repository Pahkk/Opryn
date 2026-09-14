import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { getNangoProvider } from "@/lib/integrations/nango-providers";

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const params = new URL(request.url).searchParams;
  if (
    params.get("provider") !== "google_drive" ||
    params.get("capability") !== "knowledge_import"
  )
    return NextResponse.json(
      { error: "This action is not supported." },
      { status: 400 },
    );
  try {
    getNangoProvider("google_drive");
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id,status,auth_platform,capabilities")
      .eq("organization_id", context.membership.organization_id)
      .eq("provider", "google_drive")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      {
        connectionId:
          data?.auth_platform === "nango" &&
          data.status === "connected" &&
          data.capabilities?.includes("knowledge_import")
            ? data.id
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Google Workspace is unavailable right now. Please try again." },
      { status: 503 },
    );
  }
}
