import { NextResponse } from "next/server";
import { clearSessionCookie, revokeAllSessions } from "../../../../server/d1-auth";

export async function POST(request: Request) {
  if (!await revokeAllSessions(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const response = NextResponse.json({ ok: true }); clearSessionCookie(response); return response;
}
