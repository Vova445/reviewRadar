import { NextResponse } from "next/server";
import { hashPassword, newSession, setSessionCookie } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string; name?: string } | null;
  const email = body?.email?.trim().toLowerCase(); const name = body?.name?.trim(); const password = body?.password ?? "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !name || password.length < 8) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const db = await readyDatabase();
  if (await db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first()) return NextResponse.json({ error: "account_already_exists" }, { status: 409 });
  const userId = crypto.randomUUID(); const workspaceId = crypto.randomUUID(); const now = Date.now(); const credential = await hashPassword(password);
  try { await db.batch([
    db.prepare("INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)").bind(userId, email, name, now),
    db.prepare("INSERT INTO password_credentials (user_id, password_hash, salt, iterations, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(userId, credential.hash, credential.salt, credential.iterations, now, now),
    db.prepare("INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES (?, ?, ?, ?)").bind(workspaceId, `${name} Workspace`, userId, now),
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')").bind(workspaceId, userId),
  ]); } catch { return NextResponse.json({ error: "registration_failed" }, { status: 500 }); }
  const token = await newSession(userId); const response = NextResponse.json({ authenticated: true }); setSessionCookie(response, token); return response;
}
