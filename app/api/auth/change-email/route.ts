import { NextResponse } from "next/server";
import { allowEmailSend, createAccountToken, sendAccountEmail, consumeAccountToken } from "../../../../server/account-email";
import { authenticatedUser } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; token?: unknown; locale?: unknown } | null;
  const db = await readyDatabase();
  if (typeof body?.token === "string") {
    const token = await consumeAccountToken(body.token, "change_email");
    if (!token?.target_email) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
    try { await db.prepare("UPDATE users SET email=?,email_verified_at=? WHERE id=?").bind(token.target_email, Date.now(), token.user_id).run(); }
    catch { return NextResponse.json({ error: "email_unavailable" }, { status: 409 }); }
    return NextResponse.json({ ok: true });
  }
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (email === auth.user.email || await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first()) return NextResponse.json({ error: "email_unavailable" }, { status: 409 });
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!await allowEmailSend(email, ip)) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const token = await createAccountToken(auth.user.id, "change_email", email);
  await sendAccountEmail(email, "change_email", token, typeof body?.locale === "string" ? body.locale : "en");
  return NextResponse.json({ ok: true });
}
