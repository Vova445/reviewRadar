import { describe, expect, it, vi } from "vitest";
import { minimizePII, OpenAIReviewProvider, parseClassification } from "./ai-review";

const valid = { sentiment: "positive", topics: ["service"], emotion: "satisfaction", urgency: "low", confidence: 0.92 };

describe("review AI boundary", () => {
  it("minimizes author names, email addresses, and phone numbers before provider use", () => {
    expect(minimizePII("Alice Smith called +1 (212) 555-0142 or alice@example.com", "Alice Smith"))
      .toBe("[PERSON] called [PHONE] or [EMAIL]");
  });

  it("accepts only strict classification JSON", () => {
    expect(parseClassification(valid)).toEqual(valid);
    expect(() => parseClassification('{"sentiment":"positive"}')).toThrow();
    expect(() => parseClassification({ ...valid, unexpected: true })).toThrow();
  });

  it("rejects invalid model JSON output", async () => {
    const provider = new OpenAIReviewProvider("test", "mock-model", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"sentiment":"unknown"}' } }] }), { status: 200 })) as typeof fetch);
    const raw = await provider.classify("good", 5);
    expect(() => parseClassification((raw as { output: unknown }).output)).toThrow();
  });

  it("aborts a timed out model request", async () => {
    const slowFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted", "AbortError")));
    }));
    const provider = new OpenAIReviewProvider("test", "mock-model", slowFetch as typeof fetch, 5);
    await expect(provider.classify("review", 1)).rejects.toMatchObject({ name: "AbortError" });
  });
});
