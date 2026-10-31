import { describe, expect, it } from "vitest";
import { requireWorkspaceMember, WorkspaceRole } from "./workspace-auth";

const membershipRows = [
  { user_id: "user-a", workspace_id: "workspace-a", role: "owner" },
  { user_id: "user-b", workspace_id: "workspace-b", role: "OWNER" },
];
function databaseFixture(): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              const [userId, workspaceId] = values as [string, string?];
              return membershipRows.find((row) => row.user_id === userId && (sql.includes("workspace_id=?") ? row.workspace_id === workspaceId : true)) ?? null;
            },
          };
        },
      } as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
}

describe("workspace isolation A → B", () => {
  it("allows each user in their own workspace and hides the other workspace", async () => {
    const db = databaseFixture();
    expect(await requireWorkspaceMember("user-a", "workspace-a", WorkspaceRole.MEMBER, db)).toMatchObject({ workspaceId: "workspace-a", role: WorkspaceRole.OWNER });
    expect(await requireWorkspaceMember("user-a", "workspace-b", WorkspaceRole.MEMBER, db)).toBeNull();
    expect(await requireWorkspaceMember("user-b", "workspace-b", WorkspaceRole.MEMBER, db)).toMatchObject({ workspaceId: "workspace-b", role: WorkspaceRole.OWNER });
    expect(await requireWorkspaceMember("user-b", "workspace-a", WorkspaceRole.MEMBER, db)).toBeNull();
  });

  it("uses one canonical uppercase role enum and enforces minimum roles", async () => {
    const db = databaseFixture();
    expect((await requireWorkspaceMember("user-a", "workspace-a", WorkspaceRole.OWNER, db))?.role).toBe(WorkspaceRole.OWNER);
    expect(await requireWorkspaceMember("user-a", "workspace-a", WorkspaceRole.ADMIN, db)).toBeNull();
  });
});
