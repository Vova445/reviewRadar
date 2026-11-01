import vinextWorker from "vinext/server/app-router-entry";
import { processNextSyncJob, purgeExpiredReviews } from "./server/google-business";

type WorkerEnv = Cloudflare.Env & { DB?: D1Database };

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return vinextWorker.fetch(request, env, ctx);
  },
  scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (!env.DB) return;
    if (controller.cron === "0 3 * * *") ctx.waitUntil(purgeExpiredReviews(env.DB));
    else if (controller.cron === "*/5 * * * *") ctx.waitUntil(processNextSyncJob(env.DB));
  },
};

export default worker;
