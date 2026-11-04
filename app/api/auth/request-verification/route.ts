import { NextResponse } from "next/server";
import { allowEmailSend, createAccountToken, sendAccountEmail } from "../../../../server/account-email";
import { authenticatedUser } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { locale?: unknown } | null;
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = await readyDatabase();
  const user = await db.prepare("SELECT email_verified_at FROM users WHERE id=?").bind(auth.user.id).first<{ email_verified_at: number | null }>();
  if (user?.email_verified_at) return NextResponse.json({ ok: true });
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!await allowEmailSend(auth.user.email, ip)) return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
  const token = await createAccountToken(auth.user.id, "verify_email");
  await sendAccountEmail(auth.user.email, "verify_email", token, typeof body?.locale === "string" ? body.locale : "en");
  return NextResponse.json({ ok: true });
}
