import vinextWorker from "vinext/server/app-router-entry";
import { enqueueAllSelectedSyncJobs, processNextSyncJob, purgeExpiredReviews } from "./server/google-business";
import { deliverPendingAnalysis, markAnalysisDLQ, processAnalysis, type AnalysisMessage } from "./server/analysis-queue";
import { OpenAIReviewProvider } from "./server/ai-review";
import { processNextAccountDeletion } from "./server/account-deletion";
import * as Sentry from "@sentry/cloudflare";
import { withRequestId } from "./server/request-context";
import { logError } from "./server/logger";
import { markGooglePubSubQueueFailure, processGooglePubSubQueueMessage, type GooglePushQueueMessage } from "./server/google-pubsub";
import { readyDatabase } from "./server/d1";

type WorkerEnv = Cloudflare.Env & { DB?: D1Database; ANALYSIS_QUEUE?: Queue<AnalysisMessage>; GOOGLE_SYNC_QUEUE?: Queue<GooglePushQueueMessage>; OPENAI_API_KEY?: string; OPENAI_MODEL?: string; SENTRY_DSN?: string; SENTRY_ENVIRONMENT?: string };

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const candidate=request.headers.get("x-request-id");
    const requestId=candidate&&/^[a-f0-9-]{36}$/i.test(candidate)?candidate:crypto.randomUUID();
    const headers=new Headers(request.headers);headers.set("x-request-id",requestId);
    const taggedRequest=new Request(request,{headers});
    return Sentry.withScope((scope)=>{scope.setTag("request_id",requestId);return withRequestId(requestId,async()=>{
      try{
        const response=await vinextWorker.fetch(taggedRequest,env,ctx);
        if(response.status>=500){Sentry.metrics.count("http.server.5xx",1);logError("http_5xx",{status:response.status,method:request.method});}
        const responseHeaders=new Headers(response.headers);responseHeaders.set("x-request-id",requestId);
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders});
      }catch(error){Sentry.metrics.count("http.server.5xx",1);logError("http_request_failed",{method:request.method});throw error;}
    });});
  },
  scheduled(controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    if (!env.DB) return;
    const db = env.DB;
    if (controller.cron === "0 3 * * *") {
      const requestId=`cron-${crypto.randomUUID()}`;
      ctx.waitUntil(Sentry.withScope((scope)=>{scope.setTag("request_id",requestId);return withRequestId(requestId,()=>purgeExpiredReviews(db));}));
    }
    else if (controller.cron === "*/5 * * * *") {
      const requestId=`cron-${crypto.randomUUID()}`;
      ctx.waitUntil(Sentry.withScope((scope)=>{scope.setTag("request_id",requestId);return withRequestId(requestId,async()=>{
        try{
          await processNextAccountDeletion(db);
          await processNextSyncJob(db);
          const failed=await db.prepare("SELECT COUNT(*) count FROM sync_jobs WHERE status='failed'").first<{count:number}>();
          Sentry.metrics.gauge("sync.jobs.failed",Number(failed?.count??0));
          if (env.ANALYSIS_QUEUE) await deliverPendingAnalysis(db, env.ANALYSIS_QUEUE);
        }catch(error){logError("scheduled_job_failed",{cron:controller.cron});throw error;}
      });}));
    }
  },
  async queue(batch: MessageBatch<AnalysisMessage | GooglePushQueueMessage>, env: WorkerEnv) {
    if (!env.DB) throw new Error("D1 binding DB is not configured");
    if (batch.queue.startsWith("google-push-")) {
      const db = await readyDatabase();
      for (const message of batch.messages) {
        const body = message.body as GooglePushQueueMessage;
        const requestId = `queue-${message.id}`;
        await Sentry.withScope((scope) => { scope.setTag("request_id", requestId); return withRequestId(requestId, async () => {
          if (batch.queue.includes("-dlq-")) {
            await markGooglePubSubQueueFailure(db, body.eventId);
            message.ack();
            return;
          }
          try {
            const result = await processGooglePubSubQueueMessage({ message: body, database: db, enqueueSelectedSyncJobs: enqueueAllSelectedSyncJobs });
            if (result.busy) message.retry({ delaySeconds: 30 });
            else message.ack();
          } catch {
            logError("google_pubsub_job_failed");
            message.retry({ delaySeconds: 30 });
          }
        }); });
      }
      return;
    }
    for (const queuedMessage of batch.messages) {
      const message = queuedMessage as Message<AnalysisMessage>;
      const requestId=`queue-${message.id}`;
      await Sentry.withScope((scope)=>{scope.setTag("request_id",requestId);return withRequestId(requestId,async()=>{
        if (batch.queue === "review-analysis-dlq") {
          await markAnalysisDLQ(env.DB!, message.body);
          message.ack();
          return;
        }
        if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
        try {
          await processAnalysis(message.body, env.DB!, new OpenAIReviewProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || "gpt-4o-mini"));
          message.ack();
        } catch (error) {
          await env.DB!.prepare("UPDATE analysis_jobs SET error=?,updated_at=? WHERE id=? AND status!='completed'").bind(String(error).slice(0,300), Date.now(), message.body.jobId).run();
          logError("analysis_job_failed");
          throw error;
        }
      });});
    }
  },
};

export default Sentry.withSentry((env:WorkerEnv)=>({
  dsn:env.SENTRY_DSN,
  environment:env.SENTRY_ENVIRONMENT,
  tracesSampleRate:0.1,
  tracePropagationTargets:[],
  dataCollection:{userInfo:false,cookies:false,httpHeaders:false,httpBodies:[],urlQueryParams:false,databaseQueryData:false,queues:false,genAI:{inputs:false,outputs:false},stackFrameVariables:false},
  beforeSend(event){
    event.user=undefined;event.request=undefined;event.breadcrumbs=undefined;event.extra=undefined;
    if(event.exception?.values)for(const item of event.exception.values)if(item.value)item.value=item.value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[REDACTED_EMAIL]").replace(/(?:ya29\.|1\/\/0)[A-Z0-9._~-]+/g,"[REDACTED_TOKEN]").replace(/Bearer\s+[A-Z0-9._~+/=-]+/gi,"Bearer [REDACTED_TOKEN]").replace(/(?:access_token|refresh_token|id_token|client_secret|password|authorization|code)=([^\s&]+)/gi,"$1=[REDACTED]").replace(/eyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}/g,"[REDACTED_TOKEN]");
    return event;
  },
  beforeSendSpan(span){
    for(const key of Object.keys(span.attributes))if(/url|query|email|token|user|db\.statement|db\.query/i.test(key))delete span.attributes[key];
    span.name=span.name.split("?")[0];
    return span;
  },
}),worker);
