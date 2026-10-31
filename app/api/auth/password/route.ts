import { NextResponse } from "next/server";
import { changePassword, clearSessionCookie } from "../../../../server/d1-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (typeof body?.password !== "string" || body.password.length < 8 || body.password.length > 256) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!await changePassword(request, body.password)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const response = NextResponse.json({ ok: true }); clearSessionCookie(response); return response;
}
