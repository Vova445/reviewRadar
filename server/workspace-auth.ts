export const WorkspaceRole = { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER" } as const;
export type WorkspaceRole = typeof WorkspaceRole[keyof typeof WorkspaceRole];
const ROLE_LEVEL: Record<WorkspaceRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export async function requireWorkspaceMember(userId: string, workspaceId: string | null, minRole: WorkspaceRole = WorkspaceRole.MEMBER, database?: D1Database) {
  const db = database ?? await (await import("./d1")).readyDatabase();
  const membership = workspaceId
    ? await db.prepare("SELECT workspace_id,role FROM workspace_members WHERE user_id=? AND workspace_id=? LIMIT 1").bind(userId,workspaceId).first<{workspace_id:string;role:string}>()
    : await db.prepare("SELECT workspace_id,role FROM workspace_members WHERE user_id=? LIMIT 1").bind(userId).first<{workspace_id:string;role:string}>();
  if (!membership) return null;
  const role = membership.role.trim().toUpperCase() as WorkspaceRole;
  if (!(role in ROLE_LEVEL) || ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) return null;
  return { workspaceId: membership.workspace_id, role };
}

export function requestedWorkspaceId(request: Request) {
  return request.headers.get("x-workspace-id")?.trim() || null;
}
