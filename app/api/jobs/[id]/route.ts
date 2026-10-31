import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";
import { requireWorkspaceMember, requestedWorkspaceId } from "../../../../server/workspace-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await requireWorkspaceMember(auth.user.id, requestedWorkspaceId(request));
  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { id } = await context.params;
  const db = await readyDatabase();
  const job = await db.prepare("SELECT id,status,cursor,attempts,last_error,created_at,started_at,finished_at,next_run_at FROM sync_jobs WHERE id=? AND workspace_id=? LIMIT 1").bind(id,member.workspaceId).first();
  return job ? NextResponse.json(job,{headers:{"Cache-Control":"no-store"}}) : NextResponse.json({error:"not_found"},{status:404});
}
