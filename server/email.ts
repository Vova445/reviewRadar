export type EmailKind = "welcome" | "verify_email" | "password_reset" | "weekly_report" | "critical_review" | "subscription";
export interface TransactionalEmailProvider { send(message: { idempotencyKey: string; to: string; template: EmailKind; variables: Record<string, string | number> }): Promise<{ providerMessageId: string }> }
export async function sendTransactionalEmail(provider: TransactionalEmailProvider, message: Parameters<TransactionalEmailProvider["send"]>[0]) { return provider.send(message); }
