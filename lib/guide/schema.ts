import { z } from "zod";
import {
  canGuideTarget,
  guides,
  guideSteps,
  targetIds,
  type GuideRole,
  type SetupFacts,
  type GuideId,
} from "./registry";

export const guideIds = Object.keys(guides) as [GuideId, ...GuideId[]];
export const guideReplySchema = z.object({
  message: z.string().min(1).max(1600),
  suggestedTargets: z
    .array(
      z.enum(
        targetIds as [
          (typeof targetIds)[number],
          ...(typeof targetIds)[number][],
        ],
      ),
    )
    .max(5),
  guideId: z.enum(guideIds).nullable(),
});
export type GuideReply = z.infer<typeof guideReplySchema>;
export const guideRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("ask"),
      question: z.string().trim().min(1).max(1200),
      path: z.string().max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal("show"),
      targetId: z.enum(
        targetIds as [
          (typeof targetIds)[number],
          ...(typeof targetIds)[number][],
        ],
      ),
    })
    .strict(),
  z.object({ action: z.literal("start"), guideId: z.enum(guideIds) }).strict(),
]);
export function authorizeReply(
  raw: unknown,
  role: GuideRole,
  facts: SetupFacts,
): GuideReply | null {
  const result = guideReplySchema.safeParse(raw);
  if (!result.success) return null;
  const reply = result.data;
  if (reply.suggestedTargets.some((id) => !canGuideTarget(id, role)))
    return null;
  if (reply.guideId && !guideSteps(reply.guideId, role, facts).length)
    return null;
  return reply;
}
export const resumeSchema = z
  .object({
    version: z.literal(1),
    userId: z.string(),
    organizationId: z.string(),
    steps: z
      .array(
        z
          .object({
            targetId: z.enum(
              targetIds as [
                (typeof targetIds)[number],
                ...(typeof targetIds)[number][],
              ],
            ),
            milestone: z
              .enum(["source", "approved", "answered", "team", "connection"])
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    index: z.number().int().min(0).max(7),
    title: z.string().max(100),
    savedAt: z.number(),
  })
  .strict();
