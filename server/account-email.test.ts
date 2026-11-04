import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("./d1", () => ({ readyDatabase: vi.fn() }));
import { generateAccountToken, tokenRecordUsable } from "./account-email";

describe("account email tokens", () => {
  it("generates 32 random bytes encoded as 64 hex characters", () => {
    const token = generateAccountToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(generateAccountToken()).not.toBe(token);
  });

  it("allows a live token once and rejects a used or expired token", () => {
    const now = 10_000;
    const record = { used_at: null as number | null, expires_at: now + 1 };
    expect(tokenRecordUsable(record, now)).toBe(true);
    record.used_at = now;
    expect(tokenRecordUsable(record, now)).toBe(false);
    expect(tokenRecordUsable({ used_at: null, expires_at: now }, now)).toBe(false);
  });
});
