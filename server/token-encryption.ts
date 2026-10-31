const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unbase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readKeyring() {
  const activeKeyId = process.env.OAUTH_TOKEN_ENCRYPTION_KEY_ID?.trim() || "default";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(activeKeyId)) throw new Error("INVALID_OAUTH_TOKEN_ENCRYPTION_KEY_ID");
  const keys = new Map<string, string>();
  const configured = process.env.OAUTH_TOKEN_ENCRYPTION_KEYS?.trim();
  if (configured) {
    let parsed: unknown;
    try { parsed = JSON.parse(configured); } catch { throw new Error("INVALID_OAUTH_TOKEN_ENCRYPTION_KEYS"); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("INVALID_OAUTH_TOKEN_ENCRYPTION_KEYS");
    for (const [id, secret] of Object.entries(parsed)) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || typeof secret !== "string" || secret.length < 32) throw new Error("INVALID_OAUTH_TOKEN_ENCRYPTION_KEYS");
      keys.set(id, secret);
    }
  }
  const legacySecret = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim();
  if (legacySecret && !keys.has(activeKeyId)) keys.set(activeKeyId, legacySecret);
  if (!keys.has(activeKeyId)) throw new Error("MISSING_OAUTH_TOKEN_ENCRYPTION_KEY");
  return { activeKeyId, keys };
}

export function activeTokenEncryptionKeyId() {
  return readKeyring().activeKeyId;
}

async function cryptoKey(keyId: string) {
  const { keys } = readKeyring();
  const secret = keys.get(keyId);
  if (!secret) throw new Error("UNKNOWN_OAUTH_TOKEN_ENCRYPTION_KEY_ID");
  const rawKey = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptProviderToken(plaintext: string) {
  const keyId = activeTokenEncryptionKeyId();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await cryptoKey(keyId), encoder.encode(plaintext));
  return { ciphertext: `v2.${base64(nonce)}.${base64(new Uint8Array(ciphertext))}`, keyId };
}

export async function decryptProviderToken(ciphertext: string, storedKeyId?: string | null) {
  const parts = ciphertext.split(".");
  let nonce: string;
  let data: string;
  let keyId = storedKeyId ?? "";
  if (parts[0] === "v1" && parts.length === 4) {
    // Legacy envelopes embedded key_id but decrypt used only the single active key.
    keyId ||= parts[1];
    nonce = parts[2];
    data = parts[3];
  } else if (parts[0] === "v2" && parts.length === 3 && keyId) {
    nonce = parts[1];
    data = parts[2];
  } else {
    throw new Error("INVALID_OAUTH_TOKEN_CIPHERTEXT");
  }
  try {
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(nonce) }, await cryptoKey(keyId), unbase64(data));
    return decoder.decode(decrypted);
  } catch {
    throw new Error("OAUTH_TOKEN_DECRYPTION_FAILED");
  }
}
