import { describe, expect, it } from "vitest";
import accounts from "./fixtures/google/accounts.json";
import locations from "./fixtures/google/locations.json";
import reviews from "./fixtures/google/reviews.json";
import rateLimit from "./fixtures/google/errors/429.json";
import unauthorized from "./fixtures/google/errors/401.json";

describe("Google API fixtures", () => {
  it("contains realistic account, location, and review payloads", () => {
    expect(accounts.accounts[0].name).toMatch(/^accounts\//);
    expect(locations.locations[0]).toMatchObject({ title: "Northwind Cafe Kyiv", storefrontAddress: { regionCode: "UA" } });
    expect(reviews.reviews[0]).toMatchObject({ reviewId: "review-001", starRating: "FIVE" });
  });

  it("represents retryable and revoked-access Google API responses", () => {
    expect(rateLimit.error).toMatchObject({ code: 429, status: "RESOURCE_EXHAUSTED" });
    expect(unauthorized.error).toMatchObject({ code: 401, status: "UNAUTHENTICATED" });
  });
});
