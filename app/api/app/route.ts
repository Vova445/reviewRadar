import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../server/d1-auth";
import { readyDatabase } from "../../../server/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await readyDatabase();
  const workspace = await db.prepare("SELECT w.id, w.name, wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ? LIMIT 1").bind(auth.user.id).first<{id:string;name:string;role:string}>();
  if (!workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const [stats, periods, locations, reviews, topicMentions, analyticsReviews] = await Promise.all([
    db.prepare(`SELECT COUNT(DISTINCT r.id) review_count, AVG(r.rating) rating, COUNT(DISTINCT r.location_id) active_locations, SUM(CASE WHEN a.sentiment = 'positive' THEN 1 ELSE 0 END) positive_count FROM reviews r LEFT JOIN review_analyses a ON a.review_id = r.id WHERE r.workspace_id = ?`).bind(workspace.id).first<{review_count:number;rating:number|null;active_locations:number;positive_count:number}>(),
    db.prepare(`SELECT SUM(CASE WHEN review_created_at >= ? THEN 1 ELSE 0 END) current_count, SUM(CASE WHEN review_created_at >= ? AND review_created_at < ? THEN 1 ELSE 0 END) previous_count FROM reviews WHERE workspace_id = ?`).bind(now-thirtyDays,now-thirtyDays*2,now-thirtyDays,workspace.id).first<{current_count:number;previous_count:number}>(),
    db.prepare("SELECT id, name, city, country, provider, status, rating, review_count, last_synced_at FROM locations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20").bind(workspace.id).all(),
    db.prepare(`SELECT r.id, r.location_id, l.name location_name, r.rating, r.source, r.review_created_at, c.author_name, c.comment, a.sentiment, a.sentiment_score, a.urgency, a.ai_summary FROM reviews r JOIN locations l ON l.id = r.location_id LEFT JOIN review_source_content c ON c.review_id = r.id LEFT JOIN review_analyses a ON a.review_id = r.id WHERE r.workspace_id = ? ORDER BY r.review_created_at DESC LIMIT 200`).bind(workspace.id).all(),
    db.prepare(`SELECT t.name, rt.sentiment, r.review_created_at FROM review_topics rt JOIN topics t ON t.id = rt.topic_id JOIN reviews r ON r.id = rt.review_id WHERE r.workspace_id = ? ORDER BY r.review_created_at DESC LIMIT 2000`).bind(workspace.id).all(),
    db.prepare(`SELECT r.rating, r.review_created_at, a.sentiment FROM reviews r LEFT JOIN review_analyses a ON a.review_id = r.id WHERE r.workspace_id = ? ORDER BY r.review_created_at DESC LIMIT 5000`).bind(workspace.id).all(),
  ]);
  const reviewCount = Number(stats?.review_count ?? 0);
  const currentCount = Number(periods?.current_count ?? 0);
  const previousCount = Number(periods?.previous_count ?? 0);
  return NextResponse.json({
    user: auth.user,
    workspace,
    dashboard: {
      rating: stats?.rating == null ? null : Number(stats.rating),
      reviewCount,
      positivePercent: reviewCount ? Math.round((Number(stats?.positive_count ?? 0) / reviewCount) * 100) : null,
      locationCount: Number(stats?.active_locations ?? 0),
      currentPeriodReviews: currentCount,
      previousPeriodReviews: previousCount,
      reviewGrowthPercent: previousCount ? Math.round(((currentCount - previousCount) / previousCount) * 100) : null,
    },
    locations: locations.results,
    reviews: reviews.results,
    topicMentions: topicMentions.results,
    analyticsReviews: analyticsReviews.results,
  }, { headers: { "Cache-Control": "no-store" } });
}
