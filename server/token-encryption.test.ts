import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptProviderToken, encryptProviderToken } from "./token-encryption";

afterEach(() => vi.unstubAllEnvs());

describe("provider token key rotation", () => {
  it("continues to read the previous embedded-key envelope format", async () => {
    const oldSecret = "o".repeat(48);
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEYS", JSON.stringify({ old: oldSecret, current: "n".repeat(48) }));
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEY_ID", "current");
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(oldSecret));
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, new TextEncoder().encode("legacy-refresh-token"));
    const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
    const legacyEnvelope = `v1.old.${b64(nonce)}.${b64(new Uint8Array(encrypted))}`;

    expect(await decryptProviderToken(legacyEnvelope)).toBe("legacy-refresh-token");
  });

  it("decrypts a token encrypted with the previous key after switching the active key", async () => {
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEYS", JSON.stringify({ old: "o".repeat(48), current: "n".repeat(48) }));
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEY_ID", "old");
    const oldCiphertext = await encryptProviderToken("refresh-token-fixture");

    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEY_ID", "current");
    expect(await decryptProviderToken(oldCiphertext.ciphertext, oldCiphertext.keyId)).toBe("refresh-token-fixture");

    const rotated = await encryptProviderToken("refresh-token-fixture");
    expect(rotated.keyId).toBe("current");
    expect(rotated.ciphertext).not.toBe(oldCiphertext.ciphertext);
    expect(await decryptProviderToken(rotated.ciphertext, rotated.keyId)).toBe("refresh-token-fixture");
  });

  it("uses a fresh 96-bit AES-GCM nonce for every encryption", async () => {
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEYS", JSON.stringify({ current: "n".repeat(48) }));
    vi.stubEnv("OAUTH_TOKEN_ENCRYPTION_KEY_ID", "current");
    const first = await encryptProviderToken("same-token");
    const second = await encryptProviderToken("same-token");
    expect(first.ciphertext.split(".")[1]).not.toBe(second.ciphertext.split(".")[1]);
  });
});
