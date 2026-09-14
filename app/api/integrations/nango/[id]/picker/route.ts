import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import { requireNangoCapability } from "@/lib/integrations/nango-capabilities";
import {
  ConnectionError,
  readNangoPickerCredential,
} from "@/lib/integrations/nango";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  try {
    const developerKey = process.env.GOOGLE_PICKER_API_KEY?.trim();
    const appId = process.env.GOOGLE_PICKER_APP_ID?.trim();
    if (!developerKey || !appId)
      throw new ConnectionError("Google file selection is not configured yet.");
    const { id } = await params;
    const connection = await requireNangoCapability(
      context.supabase,
      context.membership.organization_id,
      id,
      "knowledge_import",
    );
    const remote = await readNangoPickerCredential(
      connection.provider_config_key,
      connection.external_connection_id,
    );
    if (remote.tags.organization_id !== context.membership.organization_id)
      throw new ConnectionError("Connection not found.", 404);
    return NextResponse.json(
      {
        accessToken: remote.credentials.access_token,
        expiresAt: remote.credentials.expires_at,
        developerKey,
        appId,
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof ConnectionError
            ? error.message
            : "Google file selection could not start. Try again.",
      },
      { status: error instanceof ConnectionError ? error.status : 503 },
    );
  }
}
