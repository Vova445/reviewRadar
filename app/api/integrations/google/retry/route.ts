import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../../../server/d1-auth";
import { readyDatabase } from "../../../../../server/d1";
import { requireWorkspaceMember, requestedWorkspaceId, WorkspaceRole } from "../../../../../server/workspace-auth";
import { enqueueLocationSync } from "../../../../../server/google-business";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await requireWorkspaceMember(auth.user.id, requestedWorkspaceId(request), WorkspaceRole.ADMIN);
  if (!member) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  const db = await readyDatabase();
  const connection = await db.prepare("SELECT id,status FROM google_connections WHERE workspace_id=? LIMIT 1").bind(member.workspaceId).first<{id:string;status:string}>();
  if (!connection || connection.status !== "connected") return NextResponse.json({ error: "integration_not_connected" }, { status: 409 });
  const locations = await db.prepare("SELECT l.id FROM locations l JOIN google_available_locations g ON g.connection_id=? AND g.location_name=l.provider_location_id WHERE l.workspace_id=? AND l.provider='google' AND g.selected=1").bind(connection.id, member.workspaceId).all<{id:string}>();
  if (!locations.results.length) return NextResponse.json({ error: "no_selected_locations" }, { status: 409 });
  const jobs = await Promise.all(locations.results.map(({id}) => enqueueLocationSync(db, member.workspaceId, id, "manual")));
  return NextResponse.json({ ok: true, jobs }, { headers: { "Cache-Control": "no-store" } });
}
