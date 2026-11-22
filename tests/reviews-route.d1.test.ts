import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";

const shared = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../server/d1", () => ({ readyDatabase: async () => shared.db }));
vi.mock("../server/d1-auth", () => ({ authenticatedUser: async () => ({ user: { id: "user-1" } }) }));
vi.mock("../server/workspace-auth", () => ({
  requestedWorkspaceId: () => null,
  requireWorkspaceMember: async () => ({ workspaceId: "workspace-1", role: "OWNER" }),
}));

import { GET } from "../app/api/reviews/route";

let miniflare: Miniflare;
let db: D1Database;

async function setup() {
  miniflare = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('ok') } }", compatibilityDate: "2025-01-01", d1Databases: { DB: `reviews-test-${crypto.randomUUID()}` } });
  db = await miniflare.getD1Database("DB");
  shared.db = db;
  for (const sql of [
    "CREATE TABLE reviews(id TEXT PRIMARY KEY,workspace_id TEXT,location_id TEXT,rating INTEGER,source TEXT,review_created_at INTEGER)",
    "CREATE TABLE locations(id TEXT PRIMARY KEY,workspace_id TEXT,name TEXT,timezone TEXT)",
    "CREATE TABLE review_source_content(review_id TEXT PRIMARY KEY,author_name TEXT,comment TEXT)",
    "CREATE TABLE review_analyses(review_id TEXT PRIMARY KEY,sentiment TEXT,sentiment_score REAL,urgency TEXT,ai_summary TEXT)",
    "CREATE TABLE topics(id TEXT PRIMARY KEY,workspace_id TEXT,name TEXT)",
    "CREATE TABLE review_topics(review_id TEXT,topic_id TEXT, sentiment TEXT, PRIMARY KEY(review_id,topic_id))",
  ]) await db.prepare(sql).run();
  await db.prepare("INSERT INTO locations VALUES('loc-1','workspace-1','Cafe','Europe/Kyiv'),('loc-other','workspace-2','Other','UTC')").run();
  await db.prepare("INSERT INTO topics VALUES('topic-service','workspace-1','Service'),('topic-other','workspace-2','Service')").run();
  const rows = [
    ["rev-1", "workspace-1", 5, 300, "Great coffee_ and quick service", "positive", "topic-service"],
    ["rev-2", "workspace-1", 2, 200, "Slow service", "negative", "topic-service"],
    ["rev-3", "workspace-1", 4, 200, "Nice staff", "positive", null],
    ["rev-4", "workspace-1", 1, 100, "Cold food", "negative", null],
    ["rev-secret", "workspace-2", 5, 400, "Great secret", "positive", "topic-other"],
  ] as const;
  for (const [id, workspaceId, rating, createdAt, comment, sentiment, topicId] of rows) {
    const locationId = workspaceId === "workspace-1" ? "loc-1" : "loc-other";
    await db.batch([
      db.prepare("INSERT INTO reviews VALUES(?,?,?,?,?,?)").bind(id, workspaceId, locationId, rating, "google", createdAt),
      db.prepare("INSERT INTO review_source_content VALUES(?,?,?)").bind(id, "Reviewer", comment),
      db.prepare("INSERT INTO review_analyses VALUES(?,?,?,?,?)").bind(id, sentiment, 0.8, "low", "Summary"),
      ...(topicId ? [db.prepare("INSERT INTO review_topics VALUES(?,?,?)").bind(id, topicId, sentiment)] : []),
    ]);
  }
}

beforeEach(setup);
afterEach(async () => { shared.db = undefined; await miniflare?.dispose(); });

async function get(query = "") {
  return GET(new Request(`https://app.test/api/reviews${query ? `?${query}` : ""}`));
}

describe("review list API with Miniflare D1", () => {
  it("applies rating, date, sentiment, topic and literal text filters within the workspace", async () => {
    const response = await get("rating=5&from=1970-01-01&to=1970-01-01&sentiment=positive&topic=topic-service&q=coffee_");
    // The fixture timestamps are in 1970; use a wider valid date range around them.
    expect(response.status).toBe(200);
    const body = await response.json() as { reviews: { id: string }[]; total: number };
    expect(body.reviews.map(row => row.id)).toEqual(["rev-1"]);
    expect(body.total).toBe(1);
  });

  it("paginates in stable order and can move backward from a deep link cursor", async () => {
    const first = await (await get("limit=2")).json() as { reviews: { id: string }[]; pageInfo: { nextCursor: string } };
    expect(first.reviews.map(row => row.id)).toEqual(["rev-1", "rev-3"]);
    const second = await (await get(`limit=2&cursor=${encodeURIComponent(first.pageInfo.nextCursor)}`)).json() as { reviews: { id: string }[]; pageInfo: { previousCursor: string } };
    expect(second.reviews.map(row => row.id)).toEqual(["rev-2", "rev-4"]);
    const previous = await (await get(`limit=2&cursor=${encodeURIComponent(second.pageInfo.previousCursor)}&direction=previous`)).json() as { reviews: { id: string }[] };
    expect(previous.reviews.map(row => row.id)).toEqual(["rev-1", "rev-3"]);
  });

  it("supports oldest-first ordering and rejects malformed query values", async () => {
    const oldest = await (await get("limit=2&sort=oldest")).json() as { reviews: { id: string }[] };
    expect(oldest.reviews.map(row => row.id)).toEqual(["rev-4", "rev-2"]);
    expect((await get("rating=6")).status).toBe(400);
    expect((await get("from=2026-02-30")).status).toBe(400);
    expect((await get("cursor=broken")).status).toBe(400);
  });
});
