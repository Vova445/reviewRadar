import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../server/d1-auth";
import { readyDatabase } from "../../../server/d1";
import { requireWorkspaceMember, requestedWorkspaceId } from "../../../server/workspace-auth";
import { calculateDashboardMetrics } from "../../../server/dashboard-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await requireWorkspaceMember(auth.user.id, requestedWorkspaceId(request));
  if (!member) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  const db = await readyDatabase();
  const workspace = await db.prepare("SELECT w.id, w.name, wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ? AND w.id = ? LIMIT 1").bind(auth.user.id,member.workspaceId).first<{id:string;name:string;role:string}>();
  if (!workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  const now = Date.now();
  const [stats, locations, reviews, topicMentions, analyticsReviews, metricSamples] = await Promise.all([
    db.prepare(`SELECT COUNT(r.id) review_count, SUM(CASE WHEN a.review_id IS NOT NULL THEN 1 ELSE 0 END) analyzed_count, SUM(CASE WHEN a.sentiment='negative' THEN 1 ELSE 0 END) negative_count, AVG(CASE WHEN a.review_id IS NOT NULL THEN r.rating END) analyzed_rating, (SELECT COUNT(*) FROM locations WHERE workspace_id=? AND status='connected') active_locations, (SELECT MAX(last_synced_at) FROM locations WHERE workspace_id=?) latest_sync_at FROM reviews r LEFT JOIN review_analyses a ON a.review_id=r.id WHERE r.workspace_id=?`).bind(workspace.id,workspace.id,workspace.id).first<{review_count:number;analyzed_count:number;negative_count:number;analyzed_rating:number|null;active_locations:number;latest_sync_at:number|null}>(),
    db.prepare("SELECT id, name, city, country, timezone, provider, status, rating, review_count, last_synced_at FROM locations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20").bind(workspace.id).all(),
    db.prepare(`SELECT r.id, r.location_id, l.name location_name, l.timezone location_timezone, r.rating, r.source, r.review_created_at, c.author_name, c.comment, a.sentiment, a.sentiment_score, a.urgency, a.ai_summary FROM reviews r JOIN locations l ON l.id = r.location_id AND l.workspace_id=r.workspace_id LEFT JOIN review_source_content c ON c.review_id = r.id LEFT JOIN review_analyses a ON a.review_id = r.id WHERE r.workspace_id = ? ORDER BY r.review_created_at DESC LIMIT 200`).bind(workspace.id).all(),
    db.prepare(`SELECT t.name, rt.sentiment, r.review_created_at, l.timezone location_timezone FROM review_topics rt JOIN topics t ON t.id = rt.topic_id JOIN reviews r ON r.id = rt.review_id JOIN locations l ON l.id=r.location_id AND l.workspace_id=r.workspace_id WHERE r.workspace_id = ? ORDER BY r.review_created_at DESC LIMIT 2000`).bind(workspace.id).all(),
    db.prepare(`SELECT r.location_id,r.rating,r.review_created_at,l.timezone,a.sentiment,CASE WHEN a.review_id IS NULL THEN 0 ELSE 1 END analyzed FROM reviews r JOIN locations l ON l.id=r.location_id AND l.workspace_id=r.workspace_id LEFT JOIN review_analyses a ON a.review_id=r.id WHERE r.workspace_id=? ORDER BY r.review_created_at DESC LIMIT 5000`).bind(workspace.id).all<{location_id:string;rating:number;review_created_at:number;timezone:string;sentiment:string|null;analyzed:number}>(),
    db.prepare(`SELECT r.location_id,r.rating,r.review_created_at,l.timezone,a.sentiment,CASE WHEN a.review_id IS NULL THEN 0 ELSE 1 END analyzed FROM reviews r JOIN locations l ON l.id=r.location_id AND l.workspace_id=r.workspace_id LEFT JOIN review_analyses a ON a.review_id=r.id WHERE r.workspace_id=?`).bind(workspace.id).all<{location_id:string;rating:number;review_created_at:number;timezone:string;sentiment:string|null;analyzed:number}>(),
  ]);
  const metrics=calculateDashboardMetrics(metricSamples.results.map((row)=>({locationId:row.location_id,rating:Number(row.rating),reviewCreatedAt:Number(row.review_created_at),timezone:row.timezone||"Europe/Kyiv",analyzed:Number(row.analyzed)===1,sentiment:row.sentiment})),now);
  const reviewCount=Number(stats?.review_count??0),analyzedCount=Number(stats?.analyzed_count??0),stale=stats?.latest_sync_at!=null&&now-Number(stats.latest_sync_at)>24*60*60*1000;
  return NextResponse.json({
    generatedAt: now,
    user: auth.user,
    workspace,
    dashboard: {
      rating: stats?.analyzed_rating == null ? null : Number(stats.analyzed_rating),
      reviewCount,
      analyzedCount,
      negativeAnalyzedCount: Number(stats?.negative_count ?? 0),
      positivePercent: metrics.positivePercent,
      locationCount: Number(stats?.active_locations ?? 0),
      currentPeriodReviews: metrics.currentAnalyzed,
      currentPeriodTotal: metrics.currentTotal,
      currentPeriodAnalyzed: metrics.currentAnalyzed,
      previousPeriodReviews: metrics.previousAnalyzed,
      reviewGrowthPercent: metrics.growthPercent,
      currentAverageRating: metrics.currentAverageRating,
      currentSentiment: metrics.sentiment,
      latestSyncAt: stats?.latest_sync_at ?? null,
      stale,
      partial: analyzedCount < reviewCount || reviewCount > analyticsReviews.results.length,
    },
    locations: locations.results,
    reviews: reviews.results,
    topicMentions: topicMentions.results,
    analyticsReviews: analyticsReviews.results,
    analyticsCoverage: { total: metrics.currentTotal, analyzed: metrics.currentAnalyzed, positive: metrics.currentPositive, averageRating: metrics.currentAverageRating, sentiment: metrics.sentiment, sampled: reviewCount > analyticsReviews.results.length },
  }, { headers: { "Cache-Control": "no-store" } });
}
