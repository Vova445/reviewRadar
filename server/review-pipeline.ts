import { parseAIAnalysis, type ReviewAnalysisOutput } from "./ai-analysis-schema";

export type ReviewJob = { reviewId: string; workspaceId: string; locationId: string; idempotencyKey: string };

export interface PipelineDependencies {
  reviews: {
    normalize(reviewId: string): Promise<void>;
    loadTemporaryContent(reviewId: string): Promise<{ text: string; rating: number }>;
    storeAnalysis(reviewId: string, analysis: ReviewAnalysisOutput): Promise<void>;
    updateLocationStatistics(locationId: string): Promise<void>;
  };
  ai: { analyzeAsJson(input: { text: string; rating: number }): Promise<unknown> };
  alerts: { evaluate(reviewId: string, workspaceId: string): Promise<void> };
  jobs: { markComplete(key: string): Promise<void>; markFailed(key: string, error: unknown): Promise<void> };
}

export async function processNewReview(job: ReviewJob, deps: PipelineDependencies): Promise<void> {
  try {
    await deps.reviews.normalize(job.reviewId);
    const content = await deps.reviews.loadTemporaryContent(job.reviewId);
    const result = parseAIAnalysis(await deps.ai.analyzeAsJson(content));
    await deps.reviews.storeAnalysis(job.reviewId, result);
    await deps.reviews.updateLocationStatistics(job.locationId);
    await deps.alerts.evaluate(job.reviewId, job.workspaceId);
    await deps.jobs.markComplete(job.idempotencyKey);
  } catch (error) {
    await deps.jobs.markFailed(job.idempotencyKey, error);
    throw error;
  }
}
