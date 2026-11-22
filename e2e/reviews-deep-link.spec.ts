import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:4000";

test("restores review filters from a deep link and browser back/forward", async ({ page }) => {
  const requested: URL[] = [];
  await page.route("**/api/auth/session", route => route.fulfill({ json: { authenticated: true } }));
  await page.route("**/api/integrations", route => route.fulfill({ json: [] }));
  await page.route("**/api/app", route => route.fulfill({ json: {
    generatedAt: Date.now(), user: { id: "u1", email: "owner@example.com", name: "Owner" }, workspace: { id: "w1", name: "Cafe", role: "OWNER" },
    dashboard: { rating: 4.5, reviewCount: 2, analyzedCount: 2, negativeAnalyzedCount: 0, positivePercent: 100, locationCount: 1, currentPeriodReviews: 2, currentPeriodTotal: 2, currentPeriodAnalyzed: 2, previousPeriodReviews: 0, reviewGrowthPercent: null, currentAverageRating: 4.5, currentSentiment: { positive: 2, neutral: 0, negative: 0, mixed: 0 }, latestSyncAt: Date.now(), stale: false, partial: false },
    analyticsCoverage: { total: 2, analyzed: 2, positive: 2, averageRating: 4.5, sentiment: { positive: 2, neutral: 0, negative: 0, mixed: 0 }, sampled: false },
    locations: [], reviews: [], topicMentions: [], analyticsReviews: [],
  } }));
  await page.route("**/api/reviews?**", async route => {
    const url = new URL(route.request().url());
    requested.push(url);
    const secondPage = url.searchParams.has("cursor");
    return route.fulfill({ json: {
      reviews: [{ id: secondPage ? "review-2" : "review-1", location_id: "loc-1", location_name: "Cafe", location_timezone: "Europe/Kyiv", rating: 5, source: "google", review_created_at: 1_800_000_000_000, author_name: "Reviewer", comment: secondPage ? "Second page" : "Coffee was wonderful", sentiment: "positive", urgency: null, ai_summary: null }],
      total: 2, topics: [{ id: "topic-service", name: "Service" }],
      pageInfo: { hasPreviousPage: secondPage, hasNextPage: !secondPage, previousCursor: secondPage ? "cursor-first" : null, nextCursor: secondPage ? null : "cursor-next" },
    } });
  });

  await page.goto(`${baseURL}/dashboard?tab=reviews&rating=5&sentiment=positive&q=coffee`);
  await expect(page.getByRole("heading", { name: "Відгуки" })).toBeVisible();
  await expect(page.getByLabel("Пошук у відгуках")).toHaveValue("coffee");
  await expect(page.getByLabel("Оцінка")).toHaveValue("5");
  await expect(page.getByText("Coffee was wonderful")).toBeVisible();
  expect(requested[0]?.searchParams.get("rating")).toBe("5");
  expect(requested[0]?.searchParams.get("sentiment")).toBe("positive");

  await page.getByRole("button", { name: "Далі" }).click();
  await expect(page).toHaveURL(/cursor=cursor-next/);
  await expect(page.getByText("Second page")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/tab=reviews/);
  await expect(page.getByLabel("Пошук у відгуках")).toHaveValue("coffee");
  await expect(page.getByText("Coffee was wonderful")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/cursor=cursor-next/);
  await expect(page.getByText("Second page")).toBeVisible();
});
