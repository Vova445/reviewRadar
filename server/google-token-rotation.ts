import { activeTokenEncryptionKeyId, decryptProviderToken, encryptProviderToken } from "./token-encryption";
import { logInfo } from "./logger";

type TokenRow = {
  id: string;
  encrypted_refresh_token: string;
  encrypted_refresh_token_key_id: string | null;
  encrypted_access_token: string | null;
  encrypted_access_token_key_id: string | null;
};
const ROTATION_PAGE_SIZE = 10;

export async function rotateGoogleOAuthTokens(db: D1Database, cursor = "") {
  const activeKeyId = activeTokenEncryptionKeyId();
  let scanned = 0, rotated = 0, alreadyCurrent = 0, concurrentChanges = 0;
  const page = await db.prepare(`SELECT id,encrypted_refresh_token,encrypted_refresh_token_key_id,encrypted_access_token,encrypted_access_token_key_id FROM google_connections WHERE id>? ORDER BY id LIMIT ${ROTATION_PAGE_SIZE}`)
    .bind(cursor).all<TokenRow>();
  for (const row of page.results) {
      scanned++;
      let changed = false;
      if (row.encrypted_refresh_token_key_id !== activeKeyId || !row.encrypted_refresh_token.startsWith("v2.")) {
        const plaintext = await decryptProviderToken(row.encrypted_refresh_token, row.encrypted_refresh_token_key_id);
        const encrypted = await encryptProviderToken(plaintext);
        if (await decryptProviderToken(encrypted.ciphertext, encrypted.keyId) !== plaintext) throw new Error("OAUTH_TOKEN_ROTATION_VERIFY_FAILED");
        const result = await db.prepare("UPDATE google_connections SET encrypted_refresh_token=?,encrypted_refresh_token_key_id=?,updated_at=? WHERE id=? AND encrypted_refresh_token=?")
          .bind(encrypted.ciphertext, encrypted.keyId, Date.now(), row.id, row.encrypted_refresh_token).run();
        if (result.meta.changes) changed = true; else concurrentChanges++;
      }
      if (row.encrypted_access_token && (row.encrypted_access_token_key_id !== activeKeyId || !row.encrypted_access_token.startsWith("v2."))) {
        const plaintext = await decryptProviderToken(row.encrypted_access_token, row.encrypted_access_token_key_id);
        const encrypted = await encryptProviderToken(plaintext);
        if (await decryptProviderToken(encrypted.ciphertext, encrypted.keyId) !== plaintext) throw new Error("OAUTH_TOKEN_ROTATION_VERIFY_FAILED");
        const result = await db.prepare("UPDATE google_connections SET encrypted_access_token=?,encrypted_access_token_key_id=?,updated_at=? WHERE id=? AND encrypted_access_token=?")
          .bind(encrypted.ciphertext, encrypted.keyId, Date.now(), row.id, row.encrypted_access_token).run();
        if (result.meta.changes) changed = true; else concurrentChanges++;
      }
      if (changed) rotated++; else alreadyCurrent++;
  }
  const nextCursor = page.results.length ? page.results[page.results.length - 1].id : cursor;
  const complete = page.results.length < ROTATION_PAGE_SIZE;
  const pending = complete ? await db.prepare("SELECT COUNT(*) count FROM google_connections WHERE encrypted_refresh_token_key_id IS NULL OR encrypted_refresh_token_key_id<>? OR encrypted_refresh_token NOT LIKE 'v2.%' OR (encrypted_access_token IS NOT NULL AND (encrypted_access_token_key_id IS NULL OR encrypted_access_token_key_id<>? OR encrypted_access_token NOT LIKE 'v2.%'))")
    .bind(activeKeyId, activeKeyId).first<{count:number}>() : null;
  const pendingCount = pending ? Number(pending.count) : null;
  const report = { activeKeyId, scanned, rotated, alreadyCurrent, concurrentChanges, nextCursor, complete, pending: pendingCount, verified: pendingCount === 0 };
  logInfo("oauth_token_key_rotation", report);
  return report;
}
