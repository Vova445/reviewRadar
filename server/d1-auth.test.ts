import { describe, expect, it, vi } from "vitest";
vi.mock("./d1", () => ({ readyDatabase: vi.fn() }));
import { safeNext, verifyPassword, hashPassword } from "./d1-auth";

describe("safeNext", () => {
  it.each(["/dashboard", "/dashboard?tab=reviews", "/onboarding#google"]) ("keeps a safe local path: %s", (value) => {
    expect(safeNext(value)).toBe(value);
  });

  it.each([null, undefined, "", "//attacker.example", "https://attacker.example", "/\\attacker", "javascript:alert(1)"]) ("rejects an unsafe path: %s", (value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });

  it("derives and verifies password hashes", async () => {
    const credential = await hashPassword("test password");
    await expect(verifyPassword("test password", credential.hash, credential.salt, credential.iterations)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", credential.hash, credential.salt, credential.iterations)).resolves.toBe(false);
  });
});
