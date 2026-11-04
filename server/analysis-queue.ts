import { ANALYSIS_PROMPT_VERSION, estimateCostMicros, minimizePII, monthKey, parseClassification, sha256Hex, type AIProvider } from "./ai-review";

export type AnalysisMessage = { jobId: string; reviewId: string; workspaceId: string };
type DB = D1Database;
type ProviderResult = { output: unknown; inputTokens?: number; outputTokens?: number };
const DEFAULT_MODEL = "gpt-4o-mini";

export async function deliverPendingAnalysis(db: DB, queue: Queue<AnalysisMessage>, limit = 100) {
  const rows = await db.prepare("SELECT id jobId,review_id reviewId,workspace_id workspaceId FROM analysis_jobs WHERE status='queued' ORDER BY created_at LIMIT ?").bind(limit).all<AnalysisMessage>();
  for (const row of rows.results) {
    await queue.send(row);
    await db.prepare("UPDATE analysis_jobs SET status='enqueued',updated_at=? WHERE id=? AND status='queued'").bind(Date.now(), row.jobId).run();
  }
  return rows.results.length;
}

export async function processAnalysis(message: AnalysisMessage, db: DB, provider: AIProvider, now = Date.now()) {
  const job = await db.prepare("SELECT j.*,r.rating,c.comment,c.author_name FROM analysis_jobs j JOIN reviews r ON r.id=j.review_id JOIN review_source_content c ON c.review_id=r.id WHERE j.id=? AND j.review_id=? AND j.workspace_id=?").bind(message.jobId, message.reviewId, message.workspaceId).first<{id:string;workspace_id:string;review_id:string;text_hash:string;status:string;attempts:number;rating:number;comment:string|null;author_name:string|null}>();
  if (!job || job.status === "completed") return;
  await db.prepare("UPDATE analysis_jobs SET status='running',attempts=attempts+1,updated_at=? WHERE id=?").bind(now, job.id).run();
  const text = minimizePII(job.comment || "", job.author_name);
  const cacheKey = await sha256Hex(`${ANALYSIS_PROMPT_VERSION}\n${provider.model || DEFAULT_MODEL}\n${text}`);
  const cached = await db.prepare("SELECT output_json FROM analysis_cache WHERE cache_key=?").bind(cacheKey).first<{output_json:string}>();
  if (cached) {
    const output = parseClassification(JSON.parse(cached.output_json));
    await saveAnalysis(db, job, output, provider.model || DEFAULT_MODEL, now);
    return { cached: true };
  }
  const month = monthKey(new Date(now));
  const [budget, usage] = await Promise.all([
    db.prepare("SELECT monthly_limit_micros FROM workspace_ai_budgets WHERE workspace_id=?").bind(job.workspace_id).first<{monthly_limit_micros:number}>(),
    db.prepare("SELECT cost_micros FROM workspace_ai_usage WHERE workspace_id=? AND period_month=?").bind(job.workspace_id, month).first<{cost_micros:number}>(),
  ]);
  // Missing budget means unconfigured/unlimited; configured limits are enforced before provider use.
  if (budget && Number(usage?.cost_micros || 0) >= budget.monthly_limit_micros) {
    await db.prepare("UPDATE analysis_jobs SET status='budget_exceeded',error='workspace_ai_budget_exceeded',updated_at=? WHERE id=?").bind(now, job.id).run();
    return { budgetExceeded: true };
  }
  const raw = await provider.classify(text, job.rating) as unknown;
  const result = raw && typeof raw === "object" && "output" in raw ? raw as ProviderResult : { output: raw };
  const output = parseClassification(result.output);
  const inputTokens = Math.max(0, Math.floor(result.inputTokens ?? Math.ceil(text.length / 4)));
  const outputTokens = Math.max(0, Math.floor(result.outputTokens ?? 100));
  const cost = estimateCostMicros(inputTokens, outputTokens);
  if (budget && Number(usage?.cost_micros || 0) + cost > budget.monthly_limit_micros) {
    await db.prepare("UPDATE analysis_jobs SET status='budget_exceeded',error='workspace_ai_budget_exceeded',updated_at=? WHERE id=?").bind(now, job.id).run();
    return { budgetExceeded: true };
  }
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO analysis_cache(cache_key,output_json,prompt_version,model,input_tokens,output_tokens,cost_micros,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(cacheKey, JSON.stringify(output), ANALYSIS_PROMPT_VERSION, provider.model || DEFAULT_MODEL, inputTokens, outputTokens, cost, now),
    db.prepare("INSERT INTO workspace_ai_usage(workspace_id,period_month,tokens_in,tokens_out,cost_micros,analyses) VALUES(?,?,?,?,?,1) ON CONFLICT(workspace_id,period_month) DO UPDATE SET tokens_in=tokens_in+excluded.tokens_in,tokens_out=tokens_out+excluded.tokens_out,cost_micros=cost_micros+excluded.cost_micros,analyses=analyses+1").bind(job.workspace_id, month, inputTokens, outputTokens, cost),
  ]);
  await saveAnalysis(db, job, output, provider.model || DEFAULT_MODEL, now);
  return { cached: false, inputTokens, outputTokens, costMicros: cost };
}

async function saveAnalysis(db: DB, job: {review_id:string;workspace_id:string;rating:number}, output: ReturnType<typeof parseClassification>, model: string, now: number) {
  await db.prepare("INSERT INTO review_analyses(review_id,sentiment,sentiment_score,emotion,urgency,ai_summary,model_version,analyzed_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET sentiment=excluded.sentiment,sentiment_score=excluded.sentiment_score,emotion=excluded.emotion,urgency=excluded.urgency,ai_summary=excluded.ai_summary,model_version=excluded.model_version,analyzed_at=excluded.analyzed_at").bind(job.review_id, output.sentiment, output.sentiment === "positive" ? output.confidence : output.sentiment === "negative" ? -output.confidence : 0, output.emotion, output.urgency, output.topics.join(", ") || output.sentiment, `${ANALYSIS_PROMPT_VERSION}:${model}`, now).run();
  await db.batch([
    db.prepare("INSERT INTO workspace_usage_monthly(workspace_id,period_month,ai_analyses) VALUES(?,?,1) ON CONFLICT(workspace_id,period_month) DO UPDATE SET ai_analyses=ai_analyses+1").bind(job.workspace_id, monthKey(new Date(now))),
    db.prepare("UPDATE analysis_jobs SET status='completed',error=NULL,updated_at=? WHERE review_id=?").bind(now, job.review_id),
  ]);
}

export async function markAnalysisDLQ(db: DB, message: AnalysisMessage, error = "queue_retry_exhausted") {
  await db.prepare("UPDATE analysis_jobs SET status='dlq',error=?,updated_at=? WHERE id=? AND workspace_id=?").bind(error.slice(0, 300), Date.now(), message.jobId, message.workspaceId).run();
}
