import vinextWorker from "vinext/server/app-router-entry";
import { processNextSyncJob, purgeExpiredReviews } from "./server/google-business";
import { deliverPendingAnalysis, markAnalysisDLQ, processAnalysis, type AnalysisMessage } from "./server/analysis-queue";
import { OpenAIReviewProvider } from "./server/ai-review";

type WorkerEnv = Cloudflare.Env & { DB?: D1Database; ANALYSIS_QUEUE?: Queue<AnalysisMessage>; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return vinextWorker.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (!env.DB) return;
    const db = env.DB;
    if (controller.cron === "0 3 * * *") ctx.waitUntil(purgeExpiredReviews(db));
    else if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil((async () => {
        await processNextSyncJob(db);
        if (env.ANALYSIS_QUEUE) await deliverPendingAnalysis(db, env.ANALYSIS_QUEUE);
      })());
    }
  },
  async queue(batch: MessageBatch<AnalysisMessage>, env: WorkerEnv) {
    if (!env.DB) throw new Error("D1 binding DB is not configured");
    for (const message of batch.messages) {
      if (batch.queue === "review-analysis-dlq") {
        await markAnalysisDLQ(env.DB, message.body);
        message.ack();
        continue;
      }
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
      try {
        await processAnalysis(message.body, env.DB, new OpenAIReviewProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4o-mini"));
        message.ack();
      } catch (error) {
        await env.DB.prepare("UPDATE analysis_jobs SET error=?,updated_at=? WHERE id=? AND status!='completed'").bind(String(error).slice(0,300), Date.now(), message.body.jobId).run();
        throw error;
      }
    }
  },
};

export default worker;
