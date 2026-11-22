import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../server/d1-auth";
import { readyDatabase } from "../../../server/d1";
import { requireWorkspaceMember, requestedWorkspaceId } from "../../../server/workspace-auth";

export const dynamic = "force-dynamic";

type ReviewCursor = { at: number; id: string };
type ReviewFilter = { q: string; rating: number | null; from: number | null; to: number | null; sentiment: string | null; topic: string | null };
const sentiments = new Set(["positive", "neutral", "negative", "mixed"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const maxPageSize = 100;

function parseDate(value: string | null, end = false) {
  if (!value) return null;
  if (!datePattern.test(value)) return NaN;
  const at = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== value) return NaN;
  return end ? at + 86_400_000 : at;
}

function decodeCursor(value: string | null): ReviewCursor | null | undefined {
  if (!value) return null;
  try {
    const decoded = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))) as Partial<ReviewCursor>;
    if (!Number.isSafeInteger(decoded.at) || typeof decoded.id !== "string" || !decoded.id || decoded.id.length > 160) return undefined;
    return { at: decoded.at!, id: decoded.id };
  } catch { return undefined; }
}

function encodeCursor(cursor: ReviewCursor) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await requireWorkspaceMember(auth.user.id, requestedWorkspaceId(request));
  if (!member) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });

  const params = new URL(request.url).searchParams;
  const ratingValue = params.get("rating");
  const rating = ratingValue === null || ratingValue === "all" ? null : Number(ratingValue);
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"), true);
  const sentimentValue = params.get("sentiment");
  const sentiment = !sentimentValue || sentimentValue === "all" ? null : sentimentValue;
  const cursor = decodeCursor(params.get("cursor"));
  const direction = params.get("direction") === "previous" ? "previous" : "next";
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const pageSizeValue = Number(params.get("limit") ?? 25);
  const q = (params.get("q") ?? "").trim();
  const topic = params.get("topic")?.trim() || null;

  if ((rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) || Number.isNaN(from) || Number.isNaN(to) || (from !== null && to !== null && from >= to) || (sentiment !== null && !sentiments.has(sentiment)) || (cursor === undefined) || !Number.isInteger(pageSizeValue) || pageSizeValue < 1 || pageSizeValue > maxPageSize || q.length > 200 || (topic !== null && topic.length > 160)) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const filters: ReviewFilter = { q, rating, from, to, sentiment, topic };
  const clauses = ["r.workspace_id = ?"];
  const bindings: (string | number)[] = [member.workspaceId];
  if (filters.rating !== null) { clauses.push("r.rating = ?"); bindings.push(filters.rating); }
  if (filters.from !== null) { clauses.push("r.review_created_at >= ?"); bindings.push(filters.from); }
  if (filters.to !== null) { clauses.push("r.review_created_at < ?"); bindings.push(filters.to); }
  if (filters.sentiment !== null) { clauses.push("a.sentiment = ?"); bindings.push(filters.sentiment); }
  if (filters.topic !== null) {
    clauses.push("EXISTS (SELECT 1 FROM review_topics rt JOIN topics t ON t.id = rt.topic_id AND t.workspace_id = r.workspace_id WHERE rt.review_id = r.id AND t.id = ?)");
    bindings.push(filters.topic);
  }
  if (filters.q) {
    const escaped = filters.q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    clauses.push("(COALESCE(c.comment, '') LIKE ? ESCAPE '\\' OR COALESCE(c.author_name, '') LIKE ? ESCAPE '\\' OR COALESCE(a.ai_summary, '') LIKE ? ESCAPE '\\')");
    bindings.push(pattern, pattern, pattern);
  }

  const descending = sort === "newest";
  let reverseRows = false;
  if (cursor) {
    const comparison = direction === "previous" ? (descending ? ">" : "<") : (descending ? "<" : ">");
    clauses.push(`(r.review_created_at ${comparison} ? OR (r.review_created_at = ? AND r.id ${comparison} ?))`);
    bindings.push(cursor.at, cursor.at, cursor.id);
    reverseRows = direction === "previous";
  }

  let order = descending ? "DESC" : "ASC";
  if (reverseRows) order = descending ? "ASC" : "DESC";
  const where = clauses.join(" AND ");
  const db = await readyDatabase();
  const [page, count, topics] = await Promise.all([
    db.prepare(`SELECT r.id,r.location_id,l.name location_name,l.timezone location_timezone,r.rating,r.source,r.review_created_at,c.author_name,c.comment,a.sentiment,a.sentiment_score,a.urgency,a.ai_summary FROM reviews r JOIN locations l ON l.id=r.location_id AND l.workspace_id=r.workspace_id LEFT JOIN review_source_content c ON c.review_id=r.id LEFT JOIN review_analyses a ON a.review_id=r.id WHERE ${where} ORDER BY r.review_created_at ${order},r.id ${order} LIMIT ?`)
      .bind(...bindings, pageSizeValue + 1).all<ReviewRow>(),
    db.prepare(`SELECT COUNT(*) count FROM reviews r LEFT JOIN review_source_content c ON c.review_id=r.id LEFT JOIN review_analyses a ON a.review_id=r.id WHERE ${where}`).bind(...bindings).first<{ count: number }>(),
    db.prepare("SELECT id,name FROM topics WHERE workspace_id=? ORDER BY name COLLATE NOCASE LIMIT 100").bind(member.workspaceId).all<{ id: string; name: string }>(),
  ]);

  const hasExtra = page.results.length > pageSizeValue;
  let rows = page.results.slice(0, pageSizeValue);
  if (reverseRows) rows = rows.reverse();
  const hasPreviousPage = cursor ? (direction === "previous" ? hasExtra : true) : false;
  const hasNextPage = cursor && direction === "previous" ? true : hasExtra;
  const first = rows[0], last = rows.at(-1);
  return NextResponse.json({
    reviews: rows,
    total: Number(count?.count ?? 0),
    topics: topics.results,
    pageInfo: {
      hasPreviousPage,
      hasNextPage,
      previousCursor: first ? encodeCursor({ at: first.review_created_at, id: first.id }) : null,
      nextCursor: last ? encodeCursor({ at: last.review_created_at, id: last.id }) : null,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

type ReviewRow = { id: string; location_id: string; location_name: string; location_timezone: string; rating: number; source: string; review_created_at: number; author_name: string | null; comment: string | null; sentiment: string | null; sentiment_score: number | null; urgency: string | null; ai_summary: string | null };
