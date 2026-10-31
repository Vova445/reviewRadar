import { readyDatabase } from "./d1";

export type AuditEventType = "login" | "logout" | "connect" | "disconnect" | "delete" | "role_change";
const sensitiveKey = /(?:token|password|passphrase|email|comment|^review$|reviewtext|reviewbody|requestbody|body|content|cookie|authorization|secret|(?:oauth|auth|callback)?code)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Z0-9._~+/=-]+/gi;
const oauthTokenPattern = /\b(?:ya29\.[A-Z0-9._~-]+|1\/\/0[A-Z0-9._~-]+)\b/gi;
const credentialPattern = /\b(?:access_token|refresh_token|id_token|client_secret|password|authorization|oauth_code|code)=([^\s&]+)/gi;
const jwtPattern = /\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\b/gi;

function redactString(value: string) {
  return value.replace(emailPattern, "[REDACTED_EMAIL]").replace(bearerPattern, "Bearer [REDACTED_TOKEN]").replace(oauthTokenPattern, "[REDACTED_TOKEN]").replace(credentialPattern, (match) => `${match.split("=", 1)[0]}=[REDACTED]`).replace(jwtPattern, "[REDACTED_TOKEN]");
}

export function redactLogValue(value: unknown, key = ""): unknown {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
  if (sensitiveKey.test(normalizedKey)) return "[REDACTED]";
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, redactLogValue(child, childKey)]));
  return value;
}

export function serializeLog(event: string, details: Record<string, unknown> = {}) {
  return JSON.stringify(redactLogValue({ event, ...details }));
}

export function logInfo(event: string, details: Record<string, unknown> = {}) {
  console.info(serializeLog(event, details));
}

export function logError(event: string, details: Record<string, unknown> = {}) {
  console.error(serializeLog(event, details));
}

const allowedMetaKeys = new Set(["provider", "resource", "count", "reason", "outcome", "from", "to", "reconnected"]);
function safeAuditMeta(meta: Record<string, unknown> | undefined) {
  const safe = Object.fromEntries(Object.entries(meta ?? {}).filter(([key]) => allowedMetaKeys.has(key)).map(([key, value]) => [key, redactLogValue(value, key)]));
  return JSON.stringify(safe);
}

async function hashIp(request?: Request) {
  const ip = request?.headers.get("cf-connecting-ip");
  const key = process.env.AUDIT_IP_HASH_KEY?.trim();
  if (!ip || !key) return null;
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function writeAuditEvent(input: {
  type: AuditEventType;
  workspaceId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
  request?: Request;
}, database?: D1Database) {
  const db = database ?? await readyDatabase();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const meta = safeAuditMeta(input.meta);
  try {
    const ipHash = await hashIp(input.request);
    await db.prepare("INSERT INTO audit_events(id,workspace_id,user_id,type,meta,ip_hash,created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(id, input.workspaceId ?? null, input.userId ?? null, input.type, meta, ipHash, createdAt).run();
    logInfo("audit_event", { id, type: input.type, workspaceId: input.workspaceId ?? null, userId: input.userId ?? null, meta: JSON.parse(meta) });
  } catch {
    logError("audit_event_write_failed", { type: input.type, workspaceId: input.workspaceId ?? null, userId: input.userId ?? null });
  }
}
