import { z } from "zod";

export const ANALYSIS_PROMPT_VERSION = "reviews-v1";
const analysisSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  topics: z.array(z.string().trim().min(1).max(80)).max(20),
  emotion: z.enum(["delight", "satisfaction", "neutral", "disappointment", "frustration", "anger", "anxiety"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
}).strict();
export type ReviewClassification = z.infer<typeof analysisSchema>;
export type AIResult = { output: ReviewClassification; model: string; inputTokens: number; outputTokens: number; costMicros: number };
export interface AIProvider { readonly model: string; classify(text: string, rating: number): Promise<unknown> }

export function minimizePII(text: string, authorName?: string | null) {
  let result = text;
  if (authorName?.trim()) result = result.replace(new RegExp(escapeRegExp(authorName.trim()), "giu"), "[PERSON]");
  return result.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL]")
    .replace(/(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g, "[PHONE]");
}
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export class OpenAIReviewProvider implements AIProvider {
  constructor(private readonly apiKey: string, readonly model = "gpt-4o-mini", private readonly fetcher: typeof fetch = fetch, private readonly timeoutMs = 15_000) {}
  async classify(text: string, rating: number): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher("https://api.openai.com/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: "json_schema", json_schema: { name: "review_classification", strict: true, schema: { type: "object", additionalProperties: false, required: ["sentiment", "topics", "emotion", "urgency", "confidence"], properties: { sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] }, topics: { type: "array", maxItems: 20, items: { type: "string" } }, emotion: { type: "string", enum: ["delight", "satisfaction", "neutral", "disappointment", "frustration", "anger", "anxiety"] }, urgency: { type: "string", enum: ["low", "medium", "high", "critical"] }, confidence: { type: "number", minimum: 0, maximum: 1 } } } } }, messages: [{ role: "system", content: `Classify a customer review. Return only the required JSON. Prompt version: ${ANALYSIS_PROMPT_VERSION}.` }, { role: "user", content: `Rating: ${rating}/5\nReview: ${text}` }] }),
      });
      if (!response.ok) throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
      const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI_EMPTY_OUTPUT");
      const body = JSON.parse(content);
      const usage = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
      return { output: body, inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
    } finally { clearTimeout(timeout); }
  }
}

export async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseClassification(value: unknown) { return analysisSchema.parse(value); }
export function estimateCostMicros(inputTokens: number, outputTokens: number) {
  // gpt-4o-mini reference rates: $0.15/M input, $0.60/M output.
  return Math.ceil(inputTokens * 0.15 + outputTokens * 0.6);
}
export function monthKey(now = new Date()) { return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`; }
