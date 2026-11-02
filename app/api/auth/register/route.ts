import { NextResponse } from "next/server";
import { authRateLimited, clearAuthFailures, hashPassword, newSession, recordAuthFailure, setSessionCookie } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";
import { writeAuditEvent } from "../../../../server/logger";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string; name?: string } | null;
  const email = body?.email?.trim().toLowerCase(); const name = body?.name?.trim(); const password = body?.password ?? "";
  if (!email || email.length>254 || !/^\S+@\S+\.\S+$/.test(email) || !name || name.length>80 || password.length < 8 || password.length>256) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const limit = await authRateLimited(request,email); if (limit.limited) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  const credential = await hashPassword(password);
  const db = await readyDatabase();
  if (await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first()) { await recordAuthFailure(limit.key); return NextResponse.json({ error: "invalid_input" }, { status: 400 }); }
  await clearAuthFailures(limit.key);
  const userId = crypto.randomUUID(); const workspaceId = crypto.randomUUID(); const now = Date.now();
  try { await db.batch([
    db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(userId, email, name, now),
    db.prepare("INSERT INTO password_credentials (user_id, password_hash, salt, iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, credential.hash, credential.salt, credential.iterations, now, now),
    db.prepare("INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)").bind(workspaceId, `${name} Workspace`, userId, now),
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'OWNER')").bind(workspaceId, userId),
  ]); } catch { return NextResponse.json({ error: "registration_failed" }, { status: 500 }); }
  await writeAuditEvent({ type: "role_change", workspaceId, userId, meta: { from: "none", to: "OWNER", reason: "workspace_created" }, request }, db);
  const token = await newSession(userId);
  await writeAuditEvent({ type: "login", workspaceId, userId, meta: { outcome: "success" }, request }, db);
  const response = NextResponse.json({ authenticated: true }); setSessionCookie(response, token); return response;
}
