import { NextResponse } from "next/server";
import { z } from "zod";
import { accountChangesSchema } from "@/lib/account-settings";
import { createClient } from "@/lib/supabase/server";
import { rejectCrossOrigin } from "@/lib/request-origin";

export async function PATCH(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const parsed = z
    .object({
      revision: z.number().int().positive(),
      changes: accountChangesSchema,
    })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Review your account settings and try again." },
      { status: 400 },
    );
  const { data, error } = await supabase.rpc("save_account_settings", {
    expected_revision: parsed.data.revision,
    changes: parsed.data.changes,
  });
  if (error)
    return NextResponse.json(
      {
        error:
          error.code === "40001"
            ? "Your settings changed in another tab. Reload this page before saving."
            : "Your changes could not be saved. Please try again.",
      },
      { status: error.code === "40001" ? 409 : 500 },
    );
  return NextResponse.json(
    { settings: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
