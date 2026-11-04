import { readyDatabase } from "./d1";

export type AccountTokenPurpose = "verify_email" | "password_reset" | "change_email";
const encoder = new TextEncoder();
const TTL: Record<AccountTokenPurpose, number> = { verify_email: 24 * 60 * 60_000, password_reset: 60 * 60_000, change_email: 60 * 60_000 };

export function tokenRecordUsable(record: { used_at: number | null; expires_at: number }, now: number) {
  return record.used_at === null && record.expires_at > now;
}

export async function digest(value: string) {
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return [...result].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateAccountToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createAccountToken(userId: string, purpose: AccountTokenPurpose, targetEmail?: string) {
  const db = await readyDatabase();
  const token = generateAccountToken();
  const now = Date.now();
  await db.prepare("UPDATE auth_tokens SET used_at=? WHERE user_id=? AND purpose=? AND used_at IS NULL").bind(now, userId, purpose).run();
  await db.prepare("INSERT INTO auth_tokens(id,user_id,token_hash,purpose,target_email,expires_at,created_at) VALUES(?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(), userId, await digest(token), purpose, targetEmail ?? null, now + TTL[purpose], now).run();
  return token;
}

export async function consumeAccountToken(token: string, purpose: AccountTokenPurpose) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = await readyDatabase(), now = Date.now(), tokenHash = await digest(token);
  const result = await db.prepare("UPDATE auth_tokens SET used_at=? WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>? RETURNING user_id,target_email")
    .bind(now, tokenHash, purpose, now).first<{ user_id: string; target_email: string | null }>();
  return result ?? null;
}

const WINDOW_MS = 60 * 60_000;
export async function allowEmailSend(email: string, ip: string) {
  const db = await readyDatabase(), now = Date.now();
  for (const [kind, value, max] of [["email", email.trim().toLowerCase(), 5], ["ip", ip.slice(0, 120), 20]] as const) {
    const key = await digest(`${kind}:${value}`);
    await db.prepare("INSERT INTO email_send_limits(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?-window_start>=? THEN 1 ELSE count+1 END,window_start=CASE WHEN ?-window_start>=? THEN ? ELSE window_start END")
      .bind(key, now, now, WINDOW_MS, now, WINDOW_MS, now).run();
    const row = await db.prepare("SELECT count FROM email_send_limits WHERE key=?").bind(key).first<{ count: number }>();
    if ((row?.count ?? 0) > max) return false;
  }
  return true;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
const copy = {
  uk: { verify_email: ["Підтвердіть email", "Підтвердіть адресу електронної пошти ReviewRadar."], password_reset: ["Скиньте пароль", "Ми отримали запит на скидання пароля."], change_email: ["Підтвердіть новий email", "Підтвердіть нову адресу електронної пошти."], action: "Продовжити", ignore: "Якщо ви не надсилали цей запит, просто проігноруйте лист." },
  en: { verify_email: ["Verify your email", "Please verify your ReviewRadar email address."], password_reset: ["Reset your password", "We received a request to reset your password."], change_email: ["Confirm your new email", "Please confirm your new email address."], action: "Continue", ignore: "If you did not request this, you can safely ignore this email." },
} as const;

export async function sendAccountEmail(to: string, purpose: AccountTokenPurpose, token: string, locale: string) {
  const apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Email provider is not configured");
  const language = locale.toLowerCase().startsWith("uk") ? "uk" : "en", words = copy[language], [title, intro] = words[purpose];
  const url = new URL(`/auth/${purpose === "password_reset" ? "reset-password" : purpose === "change_email" ? "confirm-email" : "verify-email"}`, process.env.APP_BASE_URL || "http://localhost:4000");
  url.searchParams.set("token", token);
  const safeTitle = escapeHtml(title), safeIntro = escapeHtml(intro), safeUrl = escapeHtml(url.toString());
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${purpose}-${await digest(token)}` }, body: JSON.stringify({ from, to, subject: title, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#17202b"><h1>${safeTitle}</h1><p>${safeIntro}</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#166b56;color:white;border-radius:8px;text-decoration:none">${escapeHtml(words.action)}</a></p><p style="color:#667085">${escapeHtml(words.ignore)}</p></div>`, text: `${intro}\n\n${url}\n\n${words.ignore}` }) });
  if (!response.ok) throw new Error(`Email provider rejected message (${response.status})`);
  return response.json() as Promise<{ id: string }>;
}
