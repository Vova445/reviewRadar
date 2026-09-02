export type WorkspaceRole = "OWNER" | "ADMIN" | "MANAGER" | "VIEWER";
export type WorkspaceCapability = "billing:manage" | "integrations:manage" | "members:manage" | "reviews:write" | "reports:read" | "workspace:read";

const grants: Record<WorkspaceRole, ReadonlySet<WorkspaceCapability>> = {
  OWNER: new Set(["billing:manage", "integrations:manage", "members:manage", "reviews:write", "reports:read", "workspace:read"]),
  ADMIN: new Set(["integrations:manage", "members:manage", "reviews:write", "reports:read", "workspace:read"]),
  MANAGER: new Set(["reviews:write", "reports:read", "workspace:read"]),
  VIEWER: new Set(["reports:read", "workspace:read"]),
};

export async function requireWorkspaceCapability(args: { userId: string; workspaceId: string; capability: WorkspaceCapability; membership: { findRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> } }): Promise<WorkspaceRole> {
  const role = await args.membership.findRole(args.userId, args.workspaceId);
  if (!role || !grants[role].has(args.capability)) throw new Error("WORKSPACE_ACCESS_DENIED");
  return role;
}
