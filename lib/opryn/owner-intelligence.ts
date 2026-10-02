import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
const count = z.number().nonnegative();
export const ownerIntelligenceSchema = z.object({
  handledTeam: count,
  handledAI: count,
  escalated: count,
  openGaps: count,
  resolvedGaps: count,
  humanKnowledge: count,
  estimatedMinutes: count,
  eligibleQuestions: count,
  minutesPerQuestion: count,
  periodDays: z.literal(30),
  aiLogsLimitedByRetention: z.boolean(),
  recommendation: z
    .object({
      type: z.string(),
      title: z.string(),
      reason: z.string(),
      href: z.string().startsWith("/app/"),
      action: z.string(),
      question: z.string().optional(),
    })
    .nullable(),
  topGap: z
    .object({
      id: z.uuid(),
      title: z.string(),
      question: z.string(),
      questions: count,
      interruptions: count,
      channels: count,
    })
    .nullable(),
  keyPersonDependencies: z.array(
    z.object({ id: z.uuid(), topic: z.string(), questions: count }),
  ),
});
export type OwnerIntelligence = z.infer<typeof ownerIntelligenceSchema>;
/** Authenticated admin RPC; never callable as an anonymous/service impersonation. */
export async function getOwnerIntelligence(db: SupabaseClient, org: string) {
  const r = await db.rpc("owner_knowledge_intelligence", { target_org: org });
  if (r.error) throw r.error;
  return ownerIntelligenceSchema.parse(r.data);
}
