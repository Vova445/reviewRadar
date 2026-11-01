import { describe, expect, it } from "vitest";
import { serializeLog } from "./logger";

describe("structured logger redaction", () => {
  it("does not expose OAuth callback credentials or personal review data", () => {
    const log = serializeLog("oauth_callback", {
      response: {
        access_token: "ya29.test-access-token",
        refresh_token: "1//0.test-refresh-token",
        callbackCode: "oauth-code-value",
        email: "customer@example.com",
        review_text: "A private customer review",
      },
      provider: "google",
      outcome: "success",
    });

    expect(log).not.toContain("ya29.test-access-token");
    expect(log).not.toContain("1//0.test-refresh-token");
    expect(log).not.toContain("oauth-code-value");
    expect(log).not.toContain("customer@example.com");
    expect(log).not.toContain("A private customer review");
    expect(log).toContain("[REDACTED]");
  });
});
