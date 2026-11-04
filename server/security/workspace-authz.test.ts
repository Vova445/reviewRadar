import { describe, expect, it } from "vitest";
import { requireWorkspaceCapability } from "./workspace-authz";

describe("workspace capability authorization", () => {
  const membership = { findRole: async (userId: string, workspaceId: string) => userId === "u1" && workspaceId === "w1" ? "OWNER" as const : userId === "u2" && workspaceId === "w1" ? "MEMBER" as const : null };

  it("grants capabilities according to the member role", async () => {
    await expect(requireWorkspaceCapability({ userId: "u1", workspaceId: "w1", capability: "billing:manage", membership })).resolves.toBe("OWNER");
    await expect(requireWorkspaceCapability({ userId: "u2", workspaceId: "w1", capability: "reports:read", membership })).resolves.toBe("MEMBER");
  });

  it("denies ungranted capabilities and memberships from another workspace", async () => {
    await expect(requireWorkspaceCapability({ userId: "u2", workspaceId: "w1", capability: "billing:manage", membership })).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
    await expect(requireWorkspaceCapability({ userId: "u1", workspaceId: "w2", capability: "workspace:read", membership })).rejects.toThrow("WORKSPACE_ACCESS_DENIED");
  });
});
