import { describe, expect, it } from "vitest";
import { detectTopicAnomaly } from "./anomaly-detection";

describe("detectTopicAnomaly", () => {
  it("flags supported growth above the configured threshold", () => {
    expect(detectTopicAnomaly({ topicId: "wait-time", current: 8, previous: 4 })).toEqual({
      topicId: "wait-time",
      current: 8,
      previous: 4,
      growthPercent: 100,
      isInsight: true,
    });
  });

  it("requires double minimum support when the previous period is zero", () => {
    expect(detectTopicAnomaly({ topicId: "parking", current: 5, previous: 0 })).toMatchObject({
      growthPercent: null,
      isInsight: false,
    });
    expect(detectTopicAnomaly({ topicId: "parking", current: 6, previous: 0 })).toMatchObject({
      growthPercent: null,
      isInsight: true,
    });
  });
});
