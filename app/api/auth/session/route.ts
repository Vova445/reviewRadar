import { NextResponse } from "next/server";
import { authenticatedUser, clearSessionCookie } from "../../../../server/d1-auth";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { const auth = await authenticatedUser(request); if (!auth) { const response = NextResponse.json({ authenticated: false, configured: true }); clearSessionCookie(response); return response; }
    return NextResponse.json({ authenticated: true, configured: true, user: auth.user }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ authenticated: false, configured: false, error: "database_unavailable" }, { status: 503 }); }
}
