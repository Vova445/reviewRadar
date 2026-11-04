import { NextResponse } from "next/server";
import { consumeAccountToken } from "../../../../server/account-email";
import { readyDatabase } from "../../../../server/d1";
import { hashPassword } from "../../../../server/d1-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown; password?: unknown } | null;
  if (typeof body?.token !== "string" || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 256) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const token = await consumeAccountToken(body.token, "password_reset");
  if (!token) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
  const credential = await hashPassword(body.password), db = await readyDatabase(), now = Date.now();
  await db.batch([db.prepare("UPDATE password_credentials SET password_hash=?,salt=?,iterations=?,updated_at=? WHERE user_id=?").bind(credential.hash, credential.salt, credential.iterations, now, token.user_id), db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(token.user_id)]);
  return NextResponse.json({ ok: true });
}
