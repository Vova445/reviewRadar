import { decryptProviderToken } from "./token-encryption";
import { logError } from "./logger";

const MAX_BACKOFF = 24 * 60 * 60 * 1000;

async function revokeGoogleToken(db: D1Database, workspaceId: string) {
  const connection = await db.prepare("SELECT encrypted_refresh_token,encrypted_refresh_token_key_id FROM google_connections WHERE workspace_id=? LIMIT 1").bind(workspaceId).first<{encrypted_refresh_token:string;encrypted_refresh_token_key_id:string|null}>();
  if (!connection) return;
  const token = await decryptProviderToken(connection.encrypted_refresh_token, connection.encrypted_refresh_token_key_id);
  const response = await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), { method:"POST", signal:AbortSignal.timeout(10000) });
  if (!response.ok && response.status !== 400) throw new Error("google_revoke_failed");
}

async function eraseAccount(db: D1Database, userId: string) {
  const workspaces = await db.prepare("SELECT id FROM workspaces WHERE owner_user_id=?").bind(userId).all<{id:string}>();
  const statements: D1PreparedStatement[] = [];
  for (const {id} of workspaces.results) {
    statements.push(
      db.prepare("DELETE FROM notification_deliveries WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM alert_rules WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM notification_channels WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM reply_drafts WHERE workspace_id=? OR explicitly_approved_by=?").bind(id,userId),
      db.prepare("DELETE FROM review_topics WHERE review_id IN (SELECT id FROM reviews WHERE workspace_id=?)").bind(id),
      db.prepare("DELETE FROM analysis_jobs WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM reviews WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM insight_clusters WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM topics WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM sync_jobs WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM locations WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM google_connections WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM oauth_connections WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_subscriptions WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM weekly_reports WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_usage_monthly WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_ai_usage WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_ai_budgets WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM onboarding_state WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_preferences WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspace_members WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM oauth_states WHERE workspace_id=?").bind(id),
      db.prepare("DELETE FROM workspaces WHERE id=?").bind(id),
    );
  }
  statements.push(
    db.prepare("DELETE FROM notification_deliveries WHERE alert_rule_id IN (SELECT id FROM alert_rules WHERE created_by=?)").bind(userId),
    db.prepare("DELETE FROM alert_rules WHERE created_by=?").bind(userId),
    db.prepare("DELETE FROM reply_drafts WHERE explicitly_approved_by=?").bind(userId),
    db.prepare("DELETE FROM oauth_states WHERE user_id=?").bind(userId),
    db.prepare("DELETE FROM workspace_members WHERE user_id=?").bind(userId),
    db.prepare("DELETE FROM users WHERE id=?").bind(userId),
  );
  for (let offset=0; offset<statements.length; offset+=50) await db.batch(statements.slice(offset,offset+50));
}

export async function processNextAccountDeletion(database: D1Database) {
  const now=Date.now();
  const job=await database.prepare("SELECT id,user_id,workspace_id,attempts,status,updated_at FROM account_deletion_jobs WHERE (status IN ('queued','retry') AND next_run_at<=?) OR (status='running' AND updated_at<=?) ORDER BY created_at LIMIT 1").bind(now,now-120_000).first<{id:string;user_id:string;workspace_id:string|null;attempts:number;status:string;updated_at:number}>();
  if(!job)return {processed:false};
  const claim=await database.prepare("UPDATE account_deletion_jobs SET status='running',updated_at=? WHERE id=? AND status=? AND updated_at=?").bind(now,job.id,job.status,job.updated_at).run();
  if(!claim.meta.changes)return {processed:false};
  try {
    const owned=await database.prepare("SELECT id FROM workspaces WHERE owner_user_id=?").bind(job.user_id).all<{id:string}>();
    for(const workspace of owned.results) await revokeGoogleToken(database,workspace.id);
    await eraseAccount(database,job.user_id);
    await database.prepare("DELETE FROM account_deletion_jobs WHERE id=?").bind(job.id).run();
    return {processed:true,status:"completed"};
  } catch (error) {
    const attempts=job.attempts+1,delay=Math.min(MAX_BACKOFF,30_000*2**Math.min(attempts,11));
    await database.prepare("UPDATE account_deletion_jobs SET status='retry',attempts=?,next_run_at=?,last_error='external_revoke_or_delete_failed',updated_at=? WHERE id=?").bind(attempts,now+delay,Date.now(),job.id).run();
    logError("account_deletion_retry",{jobId:job.id,attempts,errorCode:error instanceof Error?error.message:"unknown"});
    return {processed:true,status:"retry"};
  }
}
