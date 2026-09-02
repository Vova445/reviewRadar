import { z } from "zod";
const notificationSchema = z.object({ eventId: z.string().min(1), integrationId: z.string().uuid(), locationName: z.string().min(1), eventType: z.enum(["NEW_REVIEW", "UPDATED_REVIEW"]) }).strict();

export async function acceptGoogleNotification(args: { rawBody: string; signature: string | null; verifier: { verify(rawBody: string, signature: string): Promise<boolean> }; events: { reserve(eventId: string): Promise<boolean> }; queue: { add(name: "google.fetch-review", payload: object, options: { idempotencyKey: string }): Promise<void> } }): Promise<"accepted" | "duplicate"> {
  if (!args.signature || !(await args.verifier.verify(args.rawBody, args.signature))) throw new Error("INVALID_WEBHOOK_SIGNATURE");
  const event = notificationSchema.parse(JSON.parse(args.rawBody));
  if (!(await args.events.reserve(event.eventId))) return "duplicate";
  await args.queue.add("google.fetch-review", event, { idempotencyKey: `google-event:${event.eventId}` });
  return "accepted";
}
