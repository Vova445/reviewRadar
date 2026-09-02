import { NextResponse } from "next/server";
import { newSession, setSessionCookie, verifyPassword } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase(); if (!email || !body?.password) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const db = await readyDatabase(); const row = await db.prepare("SELECT u.id, c.password_hash, c.salt, c.iterations FROM users u JOIN password_credentials c ON c.user_id = u.id WHERE u.email = ? LIMIT 1").bind(email).first<{id:string;password_hash:string;salt:string;iterations:number}>();
  if (!row || !await verifyPassword(body.password, row.password_hash, row.salt, row.iterations)) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  const token = await newSession(row.id); const response = NextResponse.json({ authenticated: true }); setSessionCookie(response, token); return response;
}
