import { NextResponse } from "next/server";
import { getRequestContext } from "@/lib/api";
import {
  getGuideContext,
  answerGuide,
  contextualReply,
} from "@/lib/guide/server";
import { guideRequestSchema } from "@/lib/guide/schema";
import { canGuideTarget, guides, guideSteps } from "@/lib/guide/registry";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  const context = await getRequestContext();
  if (context.error) return context.error;
  try {
    return json(await getGuideContext(context));
  } catch {
    return json({ error: "Setup status could not be loaded. Try again." }, 503);
  }
}
export async function POST(request: Request) {
  const context = await getRequestContext();
  if (context.error) return context.error;
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return json({ error: "Request not allowed." }, 403);
  let raw: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Choose a Guide action." }, 400);
    let bytes = 0;
    let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return json(
          { error: "Keep your question under 1,200 characters." },
          413,
        );
      }
      text += decoder.decode(part.value, { stream: true });
    }
    raw = JSON.parse(text + decoder.decode());
  } catch {
    return json({ error: "Choose a valid Guide action." }, 400);
  }
  const parsed = guideRequestSchema.safeParse(raw);
  if (!parsed.success)
    return json({ error: "That Guide action is not available." }, 400);
  try {
    const state = await getGuideContext(context);
    const input = parsed.data;
    if (input.action === "show") {
      if (!canGuideTarget(input.targetId, state.role))
        return json(
          { error: "Your role doesn't have access to that setting." },
          403,
        );
      return json({
        steps: [{ targetId: input.targetId }],
        title: "Show me",
        ...state,
      });
    }
    if (input.action === "start") {
      const steps = guideSteps(input.guideId, state.role, state.facts);
      if (!steps.length)
        return json(
          {
            error:
              "There are no remaining steps available to your role in this guide.",
          },
          403,
        );
      return json({ steps, title: guides[input.guideId].title, ...state });
    }
    // Distributed, atomic budget. Fail closed for AI if migration/config is absent.
    const budget = await context.supabase.rpc("consume_guide_question_limit", {
      target_organization_id: state.organizationId,
    });
    if (budget.error || !budget.data || !process.env.OPENAI_API_KEY)
      return json({
        ...contextualReply(input.path, state.role),
        notice:
          budget.data === false
            ? "Question limit reached. You can still use the guides below."
            : "AI help is unavailable. These tested product guides still work.",
      });
    try {
      return json(await answerGuide(input.question, input.path, state));
    } catch {
      return json({
        ...contextualReply(input.path, state.role),
        notice:
          "I couldn't answer that right now. You can still use these product guides.",
      });
    }
  } catch {
    return json({ error: "Guide could not load. Please try again." }, 503);
  }
}
