import { NextResponse } from "next/server";
import { authenticatedUser } from "../../../server/d1-auth";
import { readyDatabase } from "../../../server/d1";

async function getContext(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return null;
  const db = await readyDatabase();
  const workspace = await db.prepare("SELECT w.id,w.name FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=? ORDER BY w.created_at LIMIT 1").bind(auth.user.id).first<{ id: string; name: string }>();
  if (!workspace) return null;
  await db.prepare("INSERT OR IGNORE INTO onboarding_state(workspace_id,current_step,completed_steps,selected_location_ids,updated_at) VALUES(?,1,'[]','[]',?)").bind(workspace.id, Date.now()).run();
  return { auth, db, workspace };
}

export async function GET(request: Request) {
  const context = await getContext(request);
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { auth, db, workspace } = context;
  const [state, connection, locations, jobs, reviewCount] = await Promise.all([
    db.prepare("SELECT current_step,completed_steps,selected_location_ids,updated_at FROM onboarding_state WHERE workspace_id=?").bind(workspace.id).first<{ current_step: number; completed_steps: string; selected_location_ids: string; updated_at: number }>(),
    db.prepare("SELECT status FROM google_connections WHERE workspace_id=?").bind(workspace.id).first<{ status: string }>(),
    db.prepare("SELECT COALESCE(l.id,g.location_name) id,g.title name,g.location_name provider_location_id,l.city,l.country,g.selected FROM google_available_locations g JOIN google_connections c ON c.id=g.connection_id LEFT JOIN locations l ON l.workspace_id=c.workspace_id AND l.provider_location_id=g.location_name WHERE c.workspace_id=? ORDER BY g.title").bind(workspace.id).all<{ id: string; name: string; provider_location_id: string; city: string | null; country: string | null; selected: number | null }>(),
    db.prepare("SELECT j.status,COUNT(*) count FROM sync_jobs j JOIN locations l ON l.id=j.location_id JOIN google_connections c ON c.workspace_id=j.workspace_id JOIN google_available_locations g ON g.connection_id=c.id AND g.location_name=l.provider_location_id AND g.selected=1 WHERE j.workspace_id=? AND j.trigger_type='initial' GROUP BY j.status").bind(workspace.id).all<{ status: string; count: number }>(),
    db.prepare("SELECT COUNT(*) count FROM reviews WHERE workspace_id=?").bind(workspace.id).first<{ count: number }>(),
  ]);
  return NextResponse.json({ user: auth.user, workspace, state: { currentStep: state?.current_step ?? 1, completedSteps: JSON.parse(state?.completed_steps ?? "[]") as number[], selectedLocationIds: JSON.parse(state?.selected_location_ids ?? "[]") as string[] }, connection: connection?.status ?? "disconnected", locations: locations.results, sync: { jobs: jobs.results, reviews: Number(reviewCount?.count ?? 0) } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const context = await getContext(request);
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { step?: unknown; completed?: unknown; selectedLocationIds?: unknown } | null;
  if (typeof body?.step !== "number" || !Number.isInteger(body.step) || body.step < 1 || body.step > 4 || (body.completed !== undefined && typeof body.completed !== "boolean") || (body.selectedLocationIds !== undefined && (!Array.isArray(body.selectedLocationIds) || !body.selectedLocationIds.every((id) => typeof id === "string")))) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { db, workspace } = context;
  const previous = await db.prepare("SELECT current_step,completed_steps,selected_location_ids FROM onboarding_state WHERE workspace_id=?").bind(workspace.id).first<{ current_step: number; completed_steps: string; selected_location_ids: string }>();
  const completed = new Set<number>(JSON.parse(previous?.completed_steps ?? "[]"));
  if (body.completed) completed.add(body.step); else completed.delete(body.step);
  const selected = body.selectedLocationIds ?? JSON.parse(previous?.selected_location_ids ?? "[]");
  const step = body.completed ? Math.max(body.step, Math.min(4, body.step + 1)) : body.step;
  await db.prepare("INSERT INTO onboarding_state(workspace_id,current_step,completed_steps,selected_location_ids,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET current_step=excluded.current_step,completed_steps=excluded.completed_steps,selected_location_ids=excluded.selected_location_ids,updated_at=excluded.updated_at")
    .bind(workspace.id, step, JSON.stringify([...completed].sort()), JSON.stringify(selected), Date.now()).run();
  return NextResponse.json({ ok: true, currentStep: step, completedSteps: [...completed].sort() });
}
