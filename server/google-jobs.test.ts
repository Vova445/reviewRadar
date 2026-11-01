import { describe, expect, it, vi } from "vitest";
vi.mock("./d1", () => ({ readyDatabase: vi.fn() }));
import { claimNextSyncJob, purgeExpiredReviews, saveReviewPage } from "./google-business";

type Statement = { sql: string; args: unknown[] };
function fakeD1() {
  const state = {
    job: { id: "job-1", status: "queued", locked_until: 0, next_run_at: 0 },
    rows: new Set<string>(), retention: new Map<string, number>(), queries: [] as string[], cursor: "page-1", batches: 0, failBatchAt: 0,
  };
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            sql,
            args,
            async first() {
              if (sql.startsWith("SELECT id FROM sync_jobs")) {
                return state.job.status === "queued" && state.job.locked_until <= Number(args[1]) ? { id: state.job.id } : null;
              }
              return null;
            },
            async all() {
              if (sql.startsWith("SELECT workspace_id,COUNT(*)")) {
                const count = [...state.retention.values()].filter((deadline) => deadline <= Number(args[0])).length;
                return { results: count ? [{ workspace_id: "workspace-a", count }] : [] };
              }
              return { results: [] };
            },
            async run() {
              if (sql.startsWith("DELETE FROM reviews")) {
                let changes=0;
                for (const [key,deadline] of state.retention) if (deadline<=Number(args[0])) { state.retention.delete(key);state.rows.delete(key);changes++; }
                return {meta:{changes}};
              }
              if (sql.startsWith("UPDATE sync_jobs SET status='running'")) {
                if (state.job.status !== "queued" || state.job.locked_until > Number(args[4])) return { meta: { changes: 0 } };
                state.job.status = "running";
                state.job.locked_until = Number(args[0]);
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
    async batch(statements: Statement[]) {
      state.batches++;
      if (state.failBatchAt === state.batches) throw new Error("simulated page failure");
      for (const statement of statements) {
        state.queries.push(statement.sql);
        if (statement.sql.startsWith("INSERT INTO reviews")) { const key=`${statement.args[2]}:${statement.args[3]}`; state.rows.add(key); if(!state.retention.has(key))state.retention.set(key,Number(statement.args[9])); }
      }
      return [];
    },
  };
  return { db: db as unknown as D1Database, state };
}
const review = (id: string) => ({ reviewId: id, starRating: "FIVE", createTime: "2026-01-01T00:00:00.000Z", comment: `review ${id}` });

describe("Google sync job resilience", () => {
  it("lets only one concurrent Cron claim the same job", async () => {
    const { db, state } = fakeD1();
    const claims = await Promise.all([claimNextSyncJob(db, 1000), claimNextSyncJob(db, 1000)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(state.job.status).toBe("running");
  });
  it("keeps the page cursor unchanged when a page fails midway", async () => {
    const { db, state } = fakeD1(); state.failBatchAt = 2;
    await expect(saveReviewPage(db, { id:"job-1", workspace_id: "workspace-a", location_id: "loc-a" }, [review("one"), review("two")],121000)).rejects.toThrow("simulated page failure");
    expect(state.cursor).toBe("page-1");
    expect(state.rows.size).toBe(1);
  });
  it("upserts duplicate Google reviews without creating duplicate rows", async () => {
    const { db, state } = fakeD1();
    await saveReviewPage(db, { id:"job-1", workspace_id: "workspace-a", location_id: "loc-a" }, [review("duplicate")],121000);
    const key="loc-a:duplicate",firstDeadline=state.retention.get(key);
    await saveReviewPage(db, { id:"job-1", workspace_id: "workspace-a", location_id: "loc-a" }, [review("duplicate")],121000);
    expect(state.rows.size).toBe(1);
    expect(state.retention.get(key)).toBe(firstDeadline);
    const reviewUpsert=state.queries.find(sql=>sql.startsWith("INSERT INTO reviews"))||"";
    expect(reviewUpsert).toContain("retention_until");
    expect(reviewUpsert).not.toMatch(/retention_until\s*=\s*excluded/i);
  });
  it("purges only reviews whose first-import deadline has passed", async () => {
    const { db, state }=fakeD1();state.rows.add("loc-a:expired");state.retention.set("loc-a:expired",999);state.rows.add("loc-a:current");state.retention.set("loc-a:current",1001);
    await expect(purgeExpiredReviews(db,1000)).resolves.toBe(1);
    expect([...state.rows]).toEqual(["loc-a:current"]);
  });
});
