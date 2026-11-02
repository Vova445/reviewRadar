import { NextResponse } from "next/server";
import { authRateLimited, clearAuthFailures, newSession, recordAuthFailure, setSessionCookie, verifyPassword } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";
import { writeAuditEvent } from "../../../../server/logger";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase(); if (!email || email.length>254 || !body?.password || body.password.length>256) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  const limit = await authRateLimited(request,email); if (limit.limited) return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  const db = await readyDatabase(); const row = await db.prepare("SELECT u.id, c.password_hash, c.salt, c.iterations FROM users u JOIN password_credentials c ON c.user_id = u.id WHERE u.email = ? LIMIT 1").bind(email).first<{id:string;password_hash:string;salt:string;iterations:number}>();
  const passwordValid = row ? await verifyPassword(body.password,row.password_hash,row.salt,row.iterations) : await verifyPassword(body.password,"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==","AAAAAAAAAAAAAAAAAAAAAA==",100_000);
  if (!row || !passwordValid) {
    await recordAuthFailure(limit.key);
    const workspace = row ? await db.prepare("SELECT workspace_id FROM workspace_members WHERE user_id=? ORDER BY workspace_id LIMIT 1").bind(row.id).first<{workspace_id:string}>() : null;
    await writeAuditEvent({ type: "login", workspaceId: workspace?.workspace_id, userId: row?.id, meta: { outcome: "failure", reason: "invalid_credentials" }, request }, db);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  await clearAuthFailures(limit.key);
  const token = await newSession(row.id);
  const workspace = await db.prepare("SELECT workspace_id FROM workspace_members WHERE user_id=? ORDER BY workspace_id LIMIT 1").bind(row.id).first<{workspace_id:string}>();
  await writeAuditEvent({ type: "login", workspaceId: workspace?.workspace_id, userId: row.id, meta: { outcome: "success" }, request }, db);
  const response = NextResponse.json({ authenticated: true }); setSessionCookie(response, token); return response;
}
