import { beforeEach, describe, expect, it, vi } from "vitest";
import { receiveGooglePubSubPush, type GooglePushQueueMessage } from "./google-pubsub";

function fakeDatabase() {
  const events = new Map<string, { status: string; locked_until: number | null }>();
  const database = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT OR IGNORE")) {
                const id = String(values[0]);
                if (!events.has(id)) events.set(id, { status: "received", locked_until: null });
                return { meta: { changes: events.has(id) ? 0 : 1 } };
              }
              if (sql.startsWith("UPDATE google_notification_events SET status='enqueuing'")) {
                const id = String(values[1]), now = Number(values[2]), row = events.get(id);
                if (row && (["received", "failed"].includes(row.status) || (row.status === "enqueuing" && Number(row.locked_until ?? 0) <= now))) {
                  row.status = "enqueuing"; row.locked_until = Number(values[0]); return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.startsWith("UPDATE google_notification_events SET status='queued'")) {
                const row = events.get(String(values[0]));
                if (row?.status === "enqueuing") { row.status = "queued"; row.locked_until = null; }
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async first<T>() { return events.get(String(values[0])) as T ?? null; },
          };
        },
      };
    },
  } as unknown as D1Database;
  return database;
}

function base64url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signedGoogleToken(audience: string, email: string, now: number) {
  const keys = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const kid = crypto.randomUUID();
  const jwk = { ...await crypto.subtle.exportKey("jwk", keys.publicKey), kid, use: "sig", alg: "RS256" };
  const encodeJson = (value: unknown) => base64url(JSON.stringify(value));
  const signingInput = `${encodeJson({ alg: "RS256", kid, typ: "JWT" })}.${encodeJson({ iss: "https://accounts.google.com", aud: audience, email, email_verified: true, exp: Math.floor(now / 1000) + 300, iat: Math.floor(now / 1000) })}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", keys.privateKey, new TextEncoder().encode(signingInput)));
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { "cache-control": "max-age=300" } });
  return { authorization: `Bearer ${signingInput}.${base64url(signature)}`, fetcher };
}

describe("Google Pub/Sub push", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("deduplicates a repeated message ID and queues it once", async () => {
    const now = 1_800_000_000_000, audience = "https://example.test/v1/integrations/google/notifications", email = "pubsub@example.iam.gserviceaccount.com";
    const token = await signedGoogleToken(audience, email, now), database = fakeDatabase();
    const sent: GooglePushQueueMessage[] = [];
    const args = {
      authorization: token.authorization,
      rawBody: JSON.stringify({ message: { messageId: "message-42", data: "e30=" } }),
      audience, serviceAccountEmail: email, database, now, fetcher: token.fetcher,
      queue: { async send(message: GooglePushQueueMessage) { sent.push(message); } },
    };

    const first = await receiveGooglePubSubPush(args);
    const duplicate = await receiveGooglePubSubPush(args);

    expect(first.status).toBe(204);
    expect(duplicate).toMatchObject({ status: 204, duplicate: true });
    expect(sent).toEqual([{ eventId: "message-42" }]);
  });

  it("rejects a request with an invalid bearer token", async () => {
    const result = await receiveGooglePubSubPush({
      authorization: "Bearer invalid.token.value", rawBody: JSON.stringify({ message: { messageId: "message-42", data: "e30=" } }),
      audience: "https://example.test/push", serviceAccountEmail: "pubsub@example.iam.gserviceaccount.com",
      database: fakeDatabase(), queue: { async send() { throw new Error("should not enqueue"); } },
    });
    expect(result).toMatchObject({ status: 401, body: { error: "unauthorized" } });
  });
});
