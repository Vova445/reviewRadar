import { z } from "zod";

export const topicAnalysisSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  confidence: z.number().min(0).max(1),
});

export const reviewAnalysisSchema = z.object({
  language: z.string().trim().min(2).max(16),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  score: z.number().min(-1).max(1),
  topics: z.array(topicAnalysisSchema).max(20),
  entities: z.array(z.object({ type: z.string().max(40), value: z.string().max(160) })).max(20).default([]),
  emotion: z.enum(["delight", "satisfaction", "neutral", "disappointment", "frustration", "anger", "anxiety"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().trim().min(1).max(500),
  actionable: z.boolean(),
}).strict();

export type ReviewAnalysisOutput = z.infer<typeof reviewAnalysisSchema>;

export function parseAIAnalysis(payload: unknown): ReviewAnalysisOutput {
  return reviewAnalysisSchema.parse(payload);
}
