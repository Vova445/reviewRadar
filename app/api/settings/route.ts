import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../server/d1-auth";
import { readyDatabase } from "../../../server/d1";

export const dynamic = "force-dynamic";

async function context(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return null;
  const db = await readyDatabase();
  const workspace = await db.prepare("SELECT w.id, w.name, wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.user_id = ? LIMIT 1").bind(auth.user.id).first<{id:string;name:string;role:string}>();
  return workspace ? { auth, db, workspace } : null;
}

export async function GET(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const preferences = await value.db.prepare("SELECT locale, timezone FROM workspace_preferences WHERE workspace_id = ? LIMIT 1").bind(value.workspace.id).first<{locale:string;timezone:string}>();
  return NextResponse.json({
    user: value.auth.user,
    workspace: value.workspace,
    preferences: preferences ?? { locale: "uk", timezone: "Europe/Kyiv" },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const value = await context(request);
  if (!value) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as {name?:unknown;workspaceName?:unknown;locale?:unknown;timezone?:unknown}|null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const workspaceName = typeof body?.workspaceName === "string" ? body.workspaceName.trim() : "";
  const locale = body?.locale === "en" ? "en" : body?.locale === "uk" ? "uk" : null;
  const allowedTimezones = ["Europe/Kyiv", "Europe/Warsaw", "Europe/London", "America/New_York", "America/Los_Angeles"];
  const timezone = typeof body?.timezone === "string" && allowedTimezones.includes(body.timezone) ? body.timezone : null;
  if (name.length < 2 || name.length > 80 || workspaceName.length < 2 || workspaceName.length > 100 || !locale || !timezone) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (value.workspace.role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const now = Date.now();
  await value.db.batch([
    value.db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, value.auth.user.id),
    value.db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").bind(workspaceName, value.workspace.id),
    value.db.prepare("INSERT INTO workspace_preferences (workspace_id, locale, timezone, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET locale = excluded.locale, timezone = excluded.timezone, updated_at = excluded.updated_at").bind(value.workspace.id, locale, timezone, now),
  ]);
  return NextResponse.json({ ok: true, user: { ...value.auth.user, name }, workspace: { ...value.workspace, name: workspaceName }, preferences: { locale, timezone } });
}
