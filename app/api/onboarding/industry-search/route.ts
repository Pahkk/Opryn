import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestBusinessTypes } from "@/lib/ai/onboarding";
import { searchBusinessTypes } from "@/lib/onboarding-catalog";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  query: z.string().trim().min(3).max(180),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Describe the business in a few words first." },
      { status: 400 },
    );

  const local = searchBusinessTypes(parsed.data.query, 5);
  try {
    const suggestions = await suggestBusinessTypes(parsed.data.query);
    const merged = [
      ...suggestions,
      ...local.map((name) => ({
        name,
        reason: "A close match based on the words in your description.",
      })),
    ].filter(
      (suggestion, index, all) =>
        all.findIndex((candidate) => candidate.name === suggestion.name) ===
        index,
    );
    return NextResponse.json({ suggestions: merged.slice(0, 5), usedAi: true });
  } catch {
    return NextResponse.json({
      suggestions: local.map((name) => ({
        name,
        reason: "A close match based on the words in your description.",
      })),
      usedAi: false,
    });
  }
}
