import { afterEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { schemaStatements } from "../db/schema";
import { googleSchemaStatements } from "./google-schema";
import { processNextAccountDeletion } from "./account-deletion";

describe("account deletion worker", () => {
  let miniflare: Miniflare | undefined;
  afterEach(async () => { await miniflare?.dispose(); });

  it("removes every user and owned workspace row after Google revocation stage", async () => {
    miniflare = new Miniflare({ modules:true, script:"export default {fetch(){return new Response('ok')}}", compatibilityDate:"2025-01-01", d1Databases:{DB:`account-delete-${crypto.randomUUID()}`} });
    const db=await miniflare.getD1Database("DB");
    for(const statement of [...schemaStatements,...googleSchemaStatements]) await db.prepare(statement).run();
    const now=Date.now();
    await db.batch([
      db.prepare("INSERT INTO users(id,email,name,created_at) VALUES('delete-user','delete@example.test','Delete me',?)").bind(now),
      db.prepare("INSERT INTO workspaces(id,name,owner_user_id,created_at) VALUES('delete-workspace','Workspace','delete-user',?)").bind(now),
      db.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('delete-workspace','delete-user','OWNER')"),
      db.prepare("INSERT INTO locations(id,workspace_id,provider,name,created_at) VALUES('delete-location','delete-workspace','google','Location',?)").bind(now),
      db.prepare("INSERT INTO reviews(id,workspace_id,location_id,source,source_review_id,rating,review_created_at,source_fetched_at,content_expires_at,retention_until,created_at,updated_at) VALUES('delete-review','delete-workspace','delete-location','google','source-review',5,?,?,?, ?,?,?)").bind(now,now,now+1000,now+1000,now,now),
      db.prepare("INSERT INTO review_source_content(review_id,comment,purge_after) VALUES('delete-review','private review text',?)").bind(now+1000),
      db.prepare("INSERT INTO account_deletion_jobs(id,user_id,workspace_id,status,attempts,next_run_at,created_at,updated_at) VALUES('delete-job','delete-user','delete-workspace','queued',0,?,?,?)").bind(now,now,now),
    ]);
    await expect(processNextAccountDeletion(db)).resolves.toMatchObject({processed:true,status:"completed"});
    expect(await db.prepare("SELECT COUNT(*) count FROM users WHERE id='delete-user'").first<{count:number}>()).toMatchObject({count:0});
    expect(await db.prepare("SELECT COUNT(*) count FROM workspaces WHERE id='delete-workspace'").first<{count:number}>()).toMatchObject({count:0});
    expect(await db.prepare("SELECT COUNT(*) count FROM reviews WHERE workspace_id='delete-workspace'").first<{count:number}>()).toMatchObject({count:0});
    expect(await db.prepare("SELECT COUNT(*) count FROM review_source_content WHERE review_id='delete-review'").first<{count:number}>()).toMatchObject({count:0});
  });
});
