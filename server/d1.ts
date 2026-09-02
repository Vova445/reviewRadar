import { env } from "cloudflare:workers";
import { schemaMigrations, schemaStatements } from "../db/schema";

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
    for (const statement of schemaStatements) await db.prepare(statement).run();
    for (const migration of schemaMigrations) {
      const columns = await db.prepare(`PRAGMA table_info(${migration.table})`).all<{ name: string }>();
      if (!columns.results.some((column) => column.name === migration.column)) {
        await db.prepare(migration.statement).run();
      }
    }
    await db.prepare("PRAGMA optimize").run();
    return db;
  })().catch((error) => { initialized = null; throw error; });
  return initialized;
}
