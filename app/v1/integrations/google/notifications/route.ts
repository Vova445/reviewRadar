import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readyDatabase } from "../../../../../server/d1";
import { receiveGooglePubSubPush, type GooglePushQueueMessage } from "../../../../../server/google-pubsub";

type PushEnv = Cloudflare.Env & {
  GOOGLE_SYNC_QUEUE?: Queue<GooglePushQueueMessage>;
  GOOGLE_PUBSUB_AUDIENCE?: string;
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?: string;
};

export async function POST(request: Request) {
  const bindings = env as PushEnv;
  const audience = bindings.GOOGLE_PUBSUB_AUDIENCE?.trim();
  const serviceAccountEmail = bindings.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim();
  const queue = bindings.GOOGLE_SYNC_QUEUE;
  if (!audience || !serviceAccountEmail || !queue) {
    return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text().catch(() => "");
  const result = await receiveGooglePubSubPush({
    authorization: request.headers.get("authorization"),
    rawBody,
    audience,
    serviceAccountEmail,
    database: await readyDatabase(),
    queue,
  });
  if (result.status === 204) return new Response(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status });
}
