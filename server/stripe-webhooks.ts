import { z } from "zod";
const supportedEventSchema = z.object({ id: z.string(), type: z.enum(["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"]), data: z.object({ object: z.record(z.string(), z.unknown()) }) });

export async function handleStripeWebhook(args: { rawBody: string; signature: string | null; verifier: { constructEvent(rawBody: string, signature: string): unknown }; events: { reserve(id: string): Promise<boolean> }; subscriptions: { apply(event: z.infer<typeof supportedEventSchema>): Promise<void> } }): Promise<"processed" | "duplicate"> {
  if (!args.signature) throw new Error("MISSING_STRIPE_SIGNATURE");
  const event = supportedEventSchema.parse(args.verifier.constructEvent(args.rawBody, args.signature));
  if (!(await args.events.reserve(event.id))) return "duplicate";
  await args.subscriptions.apply(event);
  return "processed";
}
