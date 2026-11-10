export type TopicPeriod = { topicId: string; current: number; previous: number };
export type TopicAnomaly = TopicPeriod & { growthPercent: number | null; isInsight: boolean };

export function detectTopicAnomaly(input: TopicPeriod, minimumMentions = 3, growthThreshold = 30): TopicAnomaly {
  const growthPercent = input.previous === 0 ? null : ((input.current - input.previous) / input.previous) * 100;
  const hasEnoughMentions = input.current >= minimumMentions;
  const exceedsGrowthThreshold = growthPercent === null
    ? input.current >= minimumMentions * 2
    : growthPercent > growthThreshold;

  return {
    ...input,
    growthPercent,
    isInsight: hasEnoughMentions && exceedsGrowthThreshold,
  };
}
