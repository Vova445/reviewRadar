import { z } from "zod";

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const MAX_PUSH_BODY_BYTES = 64 * 1024;
const ENQUEUE_LEASE_MS = 30_000;
const PROCESS_LEASE_MS = 120_000;

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtClaims = { aud?: string | string[]; email?: string; email_verified?: boolean; exp?: number; iat?: number; iss?: string };
type GoogleJwk = JsonWebKey & { kid?: string; use?: string; alg?: string };
type JwksCache = { keys: GoogleJwk[]; expiresAt: number };
let jwksCache: JwksCache | null = null;

const pushEnvelope = z.object({
  message: z.object({
    messageId: z.string().min(1).max(256).optional(),
    message_id: z.string().min(1).max(256).optional(),
    data: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
  subscription: z.string().optional(),
}).passthrough().superRefine((value, context) => {
  if (!(value.message.messageId || value.message.message_id)) context.addIssue({ code: "custom", path: ["message", "messageId"], message: "Pub/Sub message ID is required." });
  if (!value.message.data && !Object.keys(value.message.attributes ?? {}).length) context.addIssue({ code: "custom", path: ["message", "data"], message: "Pub/Sub data or attributes are required." });
});

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function getGoogleJwk(kid: string, fetcher: typeof fetch, now: number) {
  if (!jwksCache || jwksCache.expiresAt <= now || !jwksCache.keys.some((key) => key.kid === kid)) {
    const response = await fetcher(GOOGLE_CERTS_URL, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("GOOGLE_JWKS_UNAVAILABLE");
    const payload = await response.json() as { keys?: GoogleJwk[] };
    if (!Array.isArray(payload.keys)) throw new Error("GOOGLE_JWKS_INVALID");
    const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/i)?.[1] ?? 300);
    jwksCache = { keys: payload.keys, expiresAt: now + Math.max(30, Math.min(maxAge, 3600)) * 1000 };
  }
  const jwk = jwksCache.keys.find((key) => key.kid === kid && (!key.use || key.use === "sig") && (!key.alg || key.alg === "RS256"));
  if (!jwk) throw new Error("GOOGLE_JWK_NOT_FOUND");
  return jwk;
}

export async function verifyGooglePubSubJwt(bearer: string | null, expectedAudience: string, expectedEmail: string, options: { fetcher?: typeof fetch; now?: number } = {}) {
  if (!bearer || !expectedAudience || !expectedEmail) return false;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(bearer.trim());
  if (!match) return false;
  const [encodedHeader, encodedClaims, encodedSignature, extra] = match[1].split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature || extra !== undefined) return false;
  try {
    const header = decodeJsonPart<JwtHeader>(encodedHeader);
    const claims = decodeJsonPart<JwtClaims>(encodedClaims);
    const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== "RS256" || !header.kid || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss ?? "") ||
        !audiences.includes(expectedAudience) || claims.email !== expectedEmail || claims.email_verified !== true ||
        typeof claims.exp !== "number" || claims.exp <= nowSeconds || typeof claims.iat !== "number" || claims.iat > nowSeconds + 60) return false;
    const jwk = await getGoogleJwk(header.kid, options.fetcher ?? fetch, options.now ?? Date.now());
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signedContent = new TextEncoder().encode(encodedHeader + "." + encodedClaims);
    return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(encodedSignature), signedContent);
  } catch {
    return false;
  }
}

export type GooglePushQueueMessage = { eventId: string };

export async function receiveGooglePubSubPush(args: {
  authorization: string | null; rawBody: string; audience: string; serviceAccountEmail: string; database: D1Database;
  queue: { send(message: GooglePushQueueMessage): Promise<unknown> }; now?: number; fetcher?: typeof fetch;
}) {
  if (new TextEncoder().encode(args.rawBody).byteLength > MAX_PUSH_BODY_BYTES) return { status: 413, body: { error: "payload_too_large" } };
  const authenticated = await verifyGooglePubSubJwt(args.authorization, args.audience, args.serviceAccountEmail, { fetcher: args.fetcher, now: args.now });
  if (!authenticated) return { status: 401, body: { error: "unauthorized" } };
  let envelope: z.infer<typeof pushEnvelope>;
  try { envelope = pushEnvelope.parse(JSON.parse(args.rawBody)); }
  catch { return { status: 400, body: { error: "invalid_pubsub_message" } }; }
  const messageId = envelope.message.messageId ?? envelope.message.message_id!;
  const now = args.now ?? Date.now(), leaseUntil = now + ENQUEUE_LEASE_MS;
  await args.database.prepare("INSERT OR IGNORE INTO google_notification_events(event_id,received_at,status,attempts) VALUES(?,?,'received',0)").bind(messageId, now).run();
  const claim = await args.database.prepare("UPDATE google_notification_events SET status='enqueuing',locked_until=?,attempts=attempts+1 WHERE event_id=? AND (status IN ('received','failed') OR (status='enqueuing' AND COALESCE(locked_until,0)<=?))").bind(leaseUntil, messageId, now).run();
  if (!claim.meta.changes) {
    const row = await args.database.prepare("SELECT status FROM google_notification_events WHERE event_id=?").bind(messageId).first<{ status: string }>();
    if (row?.status === "enqueuing") return { status: 503, body: { error: "delivery_in_progress" } };
    return { status: 204, body: null, duplicate: true };
  }
  try {
    await args.queue.send({ eventId: messageId });
    await args.database.prepare("UPDATE google_notification_events SET status='queued',locked_until=NULL WHERE event_id=? AND status='enqueuing' AND locked_until=?").bind(messageId, leaseUntil).run();
    return { status: 204, body: null, duplicate: false };
  } catch {
    await args.database.prepare("UPDATE google_notification_events SET status='received',locked_until=NULL WHERE event_id=? AND status='enqueuing' AND locked_until=?").bind(messageId, leaseUntil).run();
    return { status: 503, body: { error: "queue_unavailable" } };
  }
}

export async function processGooglePubSubQueueMessage(args: { message: GooglePushQueueMessage; database: D1Database; enqueueSelectedSyncJobs: () => Promise<unknown>; now?: number }) {
  const now = args.now ?? Date.now(), leaseUntil = now + PROCESS_LEASE_MS;
  const claim = await args.database.prepare("UPDATE google_notification_events SET status='processing',locked_until=? WHERE event_id=? AND (status='queued' OR (status='processing' AND COALESCE(locked_until,0)<=?))").bind(leaseUntil, args.message.eventId, now).run();
  if (!claim.meta.changes) {
    const current = await args.database.prepare("SELECT status,locked_until FROM google_notification_events WHERE event_id=?").bind(args.message.eventId).first<{ status: string; locked_until: number | null }>();
    return { processed: current?.status === "processed", busy: current?.status === "processing" && Number(current.locked_until ?? 0) > now };
  }
  try {
    await args.enqueueSelectedSyncJobs();
    await args.database.prepare("UPDATE google_notification_events SET status='processed',locked_until=NULL,completed_at=? WHERE event_id=? AND status='processing' AND locked_until=?").bind(Date.now(), args.message.eventId, leaseUntil).run();
    return { processed: true, busy: false };
  } catch (error) {
    await args.database.prepare("UPDATE google_notification_events SET status='queued',locked_until=NULL WHERE event_id=? AND status='processing' AND locked_until=?").bind(args.message.eventId, leaseUntil).run();
    throw error;
  }
}

export async function markGooglePubSubQueueFailure(database: D1Database, eventId: string) {
  await database.prepare("UPDATE google_notification_events SET status='failed',locked_until=NULL WHERE event_id=? AND status!='processed'").bind(eventId).run();
}
