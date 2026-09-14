import { NextResponse } from "next/server";
import { z } from "zod";
import { suggestBusinessTools } from "@/lib/ai/onboarding";
import {
  BUSINESS_TOOLS,
  searchBusinessTools,
  type BusinessTool,
} from "@/lib/onboarding-tools";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

function toolId(name: string) {
  return `other:${name.trim().slice(0, 70)}`;
}

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
      { error: "Enter a software name or describe what it helps you do." },
      { status: 400 },
    );

  const local = searchBusinessTools(parsed.data.query, 8);
  const knownByName = new Map(
    BUSINESS_TOOLS.map((tool) => [tool[1].toLowerCase(), tool]),
  );

  try {
    const aiMatches = await suggestBusinessTools(parsed.data.query);
    const suggestions = aiMatches.map(({ name, category, reason }) => {
      const known = knownByName.get(name.toLowerCase());
      const tool: BusinessTool = known ?? [toolId(name), name, category];
      return { tool, reason };
    });
    for (const tool of local) {
      if (!suggestions.some(({ tool: candidate }) => candidate[0] === tool[0]))
        suggestions.push({
          tool,
          reason: "A close match from Opryn's software catalog.",
        });
    }
    return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
  } catch {
    return NextResponse.json({
      suggestions: local.map((tool) => ({
        tool,
        reason: "A close match from Opryn's software catalog.",
      })),
    });
  }
}
