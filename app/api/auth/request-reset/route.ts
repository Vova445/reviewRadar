import { NextResponse } from "next/server";
import { allowEmailSend, createAccountToken, sendAccountEmail } from "../../../../server/account-email";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; locale?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!await allowEmailSend(email, ip)) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const db = await readyDatabase();
  const user = await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first<{ id: string }>();
  if (user) { try { const token = await createAccountToken(user.id, "password_reset"); await sendAccountEmail(email, "password_reset", token, typeof body?.locale === "string" ? body.locale : "en"); } catch { /* Keep the response identical for known and unknown addresses. */ } }
  return NextResponse.json({ ok: true });
}
