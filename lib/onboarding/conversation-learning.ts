import { z } from "zod";

export const conversationIntentSchema = z.object({
  provider: z.enum(["chatgpt", "claude"]),
  type: z.enum(["business", "process", "topic", "general"]),
  name: z.string().max(200),
  stage: z.enum(["type", "name", "request", "waiting"]),
  since: z.iso.datetime().optional(),
  requestId: z.uuid().optional(),
  expiresAt: z.iso.datetime().optional(),
  jobId: z.uuid().optional(),
});
export type ConversationIntent = z.infer<typeof conversationIntentSchema>;
export type ConversationProvider = ConversationIntent["provider"];
export function conversationRequest(intent: ConversationIntent) {
  // These are natural-language requests for the registered learn_from_context
  // tool, not an invented provider slash command or history-import capability.
  const focus = intent.type === "business" ? "business" : intent.type;
  const prefix = "Use Opryn to ";
  return `${prefix}learn ${focus} knowledge named ${JSON.stringify(intent.name)} from this conversation. Send only the relevant business context available here. Keep the findings for human review; do not approve them.${intent.requestId ? ` Include learning request reference ${intent.requestId}.` : ""}`;
}
export const conversationProcessing = {
  received: { label: "Conversation received", orb: null },
  processing: { label: "Reading conversation context…", orb: "weaving" },
  extracting: {
    label: "Finding useful processes and rules…",
    orb: "searching",
  },
  organizing: { label: "Preparing findings for review…", orb: "composing" },
} as const;
