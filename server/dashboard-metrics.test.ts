import { describe, expect, it } from "vitest";
import { calculateDashboardMetrics, isInLocalReviewWindow, localReviewWindows } from "./dashboard-metrics";

const ts=(value:string)=>Date.parse(value);
const fixture=[
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-03-10T09:00:00Z"),rating:5,analyzed:true,sentiment:"positive"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-03-09T09:00:00Z"),rating:4,analyzed:true,sentiment:"positive"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-03-05T09:00:00Z"),rating:1,analyzed:true,sentiment:"negative"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-02-20T09:00:00Z"),rating:3,analyzed:true,sentiment:"neutral"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-02-12T09:00:00Z"),rating:5,analyzed:true,sentiment:"mixed"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-02-01T09:00:00Z"),rating:2,analyzed:false,sentiment:null},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-01-20T09:00:00Z"),rating:4,analyzed:true,sentiment:"positive"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-01-15T09:00:00Z"),rating:1,analyzed:true,sentiment:"negative"},
  {locationId:"kyiv",timezone:"Europe/Kyiv",reviewCreatedAt:ts("2026-01-01T09:00:00Z"),rating:4,analyzed:true,sentiment:"positive"},
  {locationId:"new-york",timezone:"America/New_York",reviewCreatedAt:ts("2026-02-09T04:30:00Z"),rating:2,analyzed:false,sentiment:null},
];

describe("dashboard metric scopes and denominators",()=>{
  it("calculates the manually checked 10-review fixture",()=>{
    expect(calculateDashboardMetrics(fixture,ts("2026-03-10T12:00:00Z"))).toMatchObject({
      total:10,analyzed:8,averageRating:27/8,currentTotal:5,currentAnalyzed:5,currentAverageRating:18/5,
      currentPositive:2,positivePercent:40,previousAnalyzed:2,growthPercent:150,
      sentiment:{positive:2,neutral:1,negative:1,mixed:1},
    });
  });
  it("uses each location's local calendar boundary across UTC offsets",()=>{
    const now=ts("2026-03-10T12:00:00Z"),nyBoundary=ts("2026-02-09T04:30:00Z");
    expect(isInLocalReviewWindow(nyBoundary,now,"America/New_York")).toBe(false);
    expect(localReviewWindows(now,"Europe/Kyiv").currentStart).toBe(ts("2026-02-08T22:00:00Z"));
  });
});
