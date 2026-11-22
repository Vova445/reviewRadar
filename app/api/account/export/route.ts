import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await readyDatabase();
  const memberships = await db.prepare("SELECT w.id,w.name,w.created_at,wm.role FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=? ORDER BY w.created_at").bind(auth.user.id).all<Record<string,unknown>>();
  const workspaceIds = memberships.results.map(row => String(row.id));
  const data: Record<string, unknown> = { exportedAt: new Date().toISOString(), user: auth.user, workspaces: memberships.results, workspaceData: {} };
  const tables: Record<string,string> = {workspace_preferences:"SELECT * FROM workspace_preferences WHERE workspace_id=?",onboarding_state:"SELECT * FROM onboarding_state WHERE workspace_id=?",locations:"SELECT * FROM locations WHERE workspace_id=?",reviews:"SELECT * FROM reviews WHERE workspace_id=?",review_source_content:"SELECT c.* FROM review_source_content c JOIN reviews r ON r.id=c.review_id WHERE r.workspace_id=?",review_analyses:"SELECT a.* FROM review_analyses a JOIN reviews r ON r.id=a.review_id WHERE r.workspace_id=?",analysis_jobs:"SELECT * FROM analysis_jobs WHERE workspace_id=?",topics:"SELECT * FROM topics WHERE workspace_id=?",review_topics:"SELECT t.* FROM review_topics t JOIN reviews r ON r.id=t.review_id WHERE r.workspace_id=?",insight_clusters:"SELECT * FROM insight_clusters WHERE workspace_id=?",reply_drafts:"SELECT * FROM reply_drafts WHERE workspace_id=?",alert_rules:"SELECT * FROM alert_rules WHERE workspace_id=?",notification_channels:"SELECT * FROM notification_channels WHERE workspace_id=?",notification_deliveries:"SELECT * FROM notification_deliveries WHERE workspace_id=?",weekly_reports:"SELECT * FROM weekly_reports WHERE workspace_id=?",workspace_subscriptions:"SELECT * FROM workspace_subscriptions WHERE workspace_id=?",workspace_usage_monthly:"SELECT * FROM workspace_usage_monthly WHERE workspace_id=?",workspace_ai_budgets:"SELECT * FROM workspace_ai_budgets WHERE workspace_id=?",workspace_ai_usage:"SELECT * FROM workspace_ai_usage WHERE workspace_id=?",sync_jobs:"SELECT * FROM sync_jobs WHERE workspace_id=?",audit_events:"SELECT id,type,meta,ip_hash,created_at FROM audit_events WHERE workspace_id=?",google_connection:"SELECT id,scopes,access_expires_at,status,last_error,created_at,updated_at FROM google_connections WHERE workspace_id=?",google_available_locations:"SELECT g.account_name,g.location_name,g.title,g.address,g.selected,g.discovered_at FROM google_available_locations g JOIN google_connections c ON c.id=g.connection_id WHERE c.workspace_id=?"};
  const workspaceData: Record<string, Record<string, unknown[]>> = {};
  for (const workspaceId of workspaceIds) {
    const section: Record<string, unknown[]> = {};
    for (const [table,query] of Object.entries(tables)) {
      const rows = await db.prepare(query).bind(workspaceId).all();
      section[table] = rows.results;
    }
    workspaceData[workspaceId] = section;
  }
  data.workspaceData = workspaceData;
  return new Response(JSON.stringify(data, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="reviewradar-export-${new Date().toISOString().slice(0,10)}.json"`, "Cache-Control": "no-store" } });
}
