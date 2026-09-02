import { NextResponse } from "next/server";
import { clearSessionCookie, revokeSession } from "../../../../server/d1-auth";

export async function POST(request: Request) {
  await revokeSession(request).catch(() => null); const response = NextResponse.json({ authenticated: false }); clearSessionCookie(response); return response;
}
