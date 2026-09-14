import { z } from "zod";

export const extractedProcessSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(5000),
  purpose: z.string().min(1).max(5000),
  steps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        title: z.string().min(1).max(300),
        description: z.string().max(10000),
      }),
    )
    .min(1)
    .max(100),
  rules: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        text: z.string().min(1).max(10000),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(100),
  exceptions: z.array(z.string().min(1).max(10000)).max(100),
  clarification_questions: z.array(z.string().min(1).max(2000)).max(20),
});

export const companyAnswerSchema = z.object({
  can_answer: z.boolean(),
  confidence: z.number().min(0).max(1),
  headline: z.string().max(160),
  answer: z.string().max(10000),
  steps: z.array(z.string().min(1).max(1000)).max(8),
  important_note: z.string().max(2000),
  requires_approval: z.boolean(),
  approval_reason: z.string().max(1000),
  cited_source_ids: z.array(z.string().uuid()).max(15),
});

export const employeeImageCaseSchema = z.object({
  description: z.string().min(1).max(2000),
  knowledge_search_query: z.string().min(3).max(1000),
  visible_text: z.string().max(2000),
});

export const suggestedRuleSchema = z.object({
  title: z.string().min(1).max(200),
  rule: z.string().min(1).max(10000),
  complete: z.boolean(),
  clarification_questions: z.array(z.string().min(1).max(500)).max(3),
});

export const knowledgeRelationshipSchema = z.object({
  relationships: z
    .array(
      z.object({
        source_id: z.string().uuid(),
        relationship: z.enum(["compatible", "possible_duplicate", "conflict"]),
        explanation: z.string().max(1000),
      }),
    )
    .max(8),
});

export const processRecommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        reason: z.string().min(1).max(2000),
        suggested_prompt: z.string().min(1).max(5000),
        priority: z.number().int().min(1).max(10),
      }),
    )
    .min(4)
    .max(6),
});

export const callLearningSchema = z.object({
  summary: z.string().min(1).max(3000),
  findings: z
    .array(
      z.object({
        type: z.enum([
          "customer_question",
          "sales_objection",
          "successful_response",
          "company_rule",
          "process",
          "exception",
          "training_example",
          "repeated_answer",
        ]),
        title: z.string().min(1).max(250),
        content: z.string().min(1).max(10000),
        evidence: z.string().max(2000),
        confidence: z.number().min(0).max(1),
        needs_clarification: z.boolean(),
      }),
    )
    .max(40),
});

export const videoAnalysisSchema = z.object({
  observations: z
    .array(
      z.object({
        type: z.enum([
          "software_action",
          "decision_point",
          "rule_candidate",
          "exception",
          "responsibility",
        ]),
        text: z.string().min(1).max(2000),
        confidence: z.number().min(0).max(1),
        needs_confirmation: z.boolean(),
      }),
    )
    .max(30),
});

export type ExtractedProcess = z.infer<typeof extractedProcessSchema>;
export type ProcessRecommendations = z.infer<
  typeof processRecommendationsSchema
>["recommendations"];
export type CallLearning = z.infer<typeof callLearningSchema>;
export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;
