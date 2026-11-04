import { NextResponse } from "next/server";
import { consumeAccountToken } from "../../../../server/account-email";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  if (typeof body?.token !== "string") return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  const token = await consumeAccountToken(body.token, "verify_email");
  if (!token) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
  const db = await readyDatabase();
  await db.prepare("UPDATE users SET email_verified_at=? WHERE id=?").bind(Date.now(), token.user_id).run();
  return NextResponse.json({ ok: true });
}
