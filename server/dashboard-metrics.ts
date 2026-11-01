export type MetricReview = {
  locationId: string;
  timezone: string;
  rating: number;
  reviewCreatedAt: number;
  analyzed: boolean;
  sentiment: string | null;
};

type LocalDate = { year: number; month: number; day: number };
function localDate(timestamp: number, timezone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp);
  return { year: Number(parts.find((part) => part.type === "year")?.value), month: Number(parts.find((part) => part.type === "month")?.value), day: Number(parts.find((part) => part.type === "day")?.value) };
}

function localMidnight(date: LocalDate, timezone: string) {
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let guess = target;
  for (let pass = 0; pass < 3; pass++) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(guess);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const wallClock = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    guess = target - (wallClock - guess);
  }
  return guess;
}

function shiftedDate(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function localReviewWindows(now: number, timezone: string) {
  const today = localDate(now, timezone);
  const currentStart = localMidnight(shiftedDate(today, -29), timezone);
  const previousStart = localMidnight(shiftedDate(today, -59), timezone);
  return { currentStart, currentEnd: now, previousStart, previousEnd: currentStart };
}

export function isInLocalReviewWindow(timestamp: number, now: number, timezone: string) {
  const window = localReviewWindows(now, timezone);
  return timestamp >= window.currentStart && timestamp <= window.currentEnd;
}

export function resolveLocationTimezone(address: { regionCode?: string; locality?: string; administrativeArea?: string }, fallback = "Europe/Kyiv") {
  const region = (address.regionCode ?? "").toUpperCase();
  const place = `${address.locality ?? ""} ${address.administrativeArea ?? ""}`.toLowerCase();
  if (["UA"].includes(region)) return "Europe/Kyiv";
  if (region === "PL") return "Europe/Warsaw";
  if (["GB", "UK"].includes(region)) return "Europe/London";
  if (region === "US") {
    if (/new york|boston|philadelphia|washington|miami|atlanta/.test(place)) return "America/New_York";
    if (/los angeles|san francisco|san diego|san jose|seattle|portland/.test(place)) return "America/Los_Angeles";
    if (/chicago|dallas|houston|austin|denver/.test(place)) return "America/Chicago";
  }
  if (region === "CA") {
    if (/vancouver|victoria/.test(place)) return "America/Vancouver";
    if (/toronto|ottawa|montreal/.test(place)) return "America/Toronto";
  }
  try { new Intl.DateTimeFormat("en", { timeZone: fallback }); return fallback; } catch { return "UTC"; }
}

export function calculateDashboardMetrics(reviews: MetricReview[], now: number) {
  let total = 0, analyzed = 0, ratingSum = 0, currentTotal = 0, currentAnalyzed = 0, currentRatingSum = 0, previousAnalyzed = 0, currentPositive = 0;
  const sentiment = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  const windowsByTimezone = new Map<string, ReturnType<typeof localReviewWindows>>();
  for (const review of reviews) {
    total++;
    if (review.analyzed) { analyzed++; ratingSum += review.rating; }
    let window = windowsByTimezone.get(review.timezone);
    if (!window) { window = localReviewWindows(now, review.timezone); windowsByTimezone.set(review.timezone, window); }
    if (review.reviewCreatedAt >= window.currentStart && review.reviewCreatedAt <= window.currentEnd) {
      currentTotal++;
      if (review.analyzed) {
        currentAnalyzed++;
        currentRatingSum += review.rating;
        if (review.sentiment === "positive") currentPositive++;
        if (review.sentiment && review.sentiment in sentiment) sentiment[review.sentiment as keyof typeof sentiment]++;
      }
    } else if (review.reviewCreatedAt >= window.previousStart && review.reviewCreatedAt < window.previousEnd && review.analyzed) {
      previousAnalyzed++;
    }
  }
  return {
    total, analyzed, averageRating: analyzed ? ratingSum / analyzed : null,
    currentTotal, currentAnalyzed, currentAverageRating: currentAnalyzed ? currentRatingSum / currentAnalyzed : null, currentPositive,
    positivePercent: currentAnalyzed ? Math.round(currentPositive / currentAnalyzed * 100) : null,
    previousAnalyzed,
    growthPercent: previousAnalyzed ? Math.round((currentAnalyzed - previousAnalyzed) / previousAnalyzed * 100) : null,
    sentiment,
  };
}
