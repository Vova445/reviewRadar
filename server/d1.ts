import { env } from "cloudflare:workers";
import { schemaMigrations, schemaStatements } from "../db/schema";
import { googleSchemaStatements } from "./google-schema";

type RuntimeEnv = Cloudflare.Env & { DB?: D1Database };
let initialized: Promise<D1Database> | null = null;

export function database() {
  const db = (env as RuntimeEnv).DB;
  if (!db) throw new Error("D1 binding DB is not configured");
  return db;
}

export function readyDatabase() {
  if (!initialized) initialized = (async () => {
    const db = database();
    for (const statement of [...schemaStatements, ...googleSchemaStatements]) await db.prepare(statement).run();
    for (const migration of schemaMigrations) {
      const columns = await db.prepare(`PRAGMA table_info(${migration.table})`).all<{ name: string }>();
      if (!columns.results.some((column) => column.name === migration.column)) {
        await db.prepare(migration.statement).run();
      }
    }
    await db.prepare("UPDATE google_connections SET encrypted_refresh_token_key_id=substr(substr(encrypted_refresh_token,4),1,instr(substr(encrypted_refresh_token,4),'.')-1) WHERE encrypted_refresh_token_key_id IS NULL AND encrypted_refresh_token LIKE 'v1.%'").run();
    await db.prepare("UPDATE google_connections SET encrypted_access_token_key_id=substr(substr(encrypted_access_token,4),1,instr(substr(encrypted_access_token,4),'.')-1) WHERE encrypted_access_token_key_id IS NULL AND encrypted_access_token LIKE 'v1.%'").run();
    await db.prepare("UPDATE reviews SET retention_until=created_at+2592000000 WHERE retention_until=0").run();
    await db.prepare("UPDATE review_source_content SET purge_after=(SELECT retention_until FROM reviews WHERE reviews.id=review_source_content.review_id) WHERE EXISTS (SELECT 1 FROM reviews WHERE reviews.id=review_source_content.review_id)").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_reviews_retention_until ON reviews(retention_until)").run();
    await db.prepare("UPDATE sync_jobs SET status='failed',finished_at=COALESCE(finished_at,?) WHERE location_id IN (SELECT location_id FROM sync_jobs WHERE status IN ('queued','running','retry') AND location_id IS NOT NULL GROUP BY location_id HAVING COUNT(*)>1) AND id NOT IN (SELECT MAX(id) FROM sync_jobs WHERE status IN ('queued','running','retry') AND location_id IS NOT NULL GROUP BY location_id)").bind(Date.now()).run();
    await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_jobs_active_location ON sync_jobs(location_id) WHERE location_id IS NOT NULL AND status IN ('queued','running','retry')").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_sync_jobs_next_run ON sync_jobs(status,next_run_at,locked_until)").run();
    await db.prepare("PRAGMA optimize").run();
    return db;
  })().catch((error) => { initialized = null; throw error; });
  return initialized;
}
