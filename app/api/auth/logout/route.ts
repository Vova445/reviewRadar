import { NextResponse } from "next/server";
import { authenticatedUser, clearSessionCookie, revokeSession } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";
import { writeAuditEvent } from "../../../../server/logger";

export async function POST(request: Request) {
  const auth = await authenticatedUser(request).catch(() => null);
  if (auth) {
    const db = await readyDatabase();
    const workspace = await db.prepare("SELECT workspace_id FROM workspace_members WHERE user_id=? ORDER BY workspace_id LIMIT 1").bind(auth.user.id).first<{workspace_id:string}>();
    await writeAuditEvent({ type: "logout", workspaceId: workspace?.workspace_id, userId: auth.user.id, meta: { outcome: "success" }, request }, db);
  }
  await revokeSession(request).catch(() => null); const response = NextResponse.json({ authenticated: false }); clearSessionCookie(response); return response;
}
