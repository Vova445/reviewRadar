import { NextResponse } from "next/server";
import { readyDatabase } from "./d1";

const ITERATIONS = 100_000;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_FAILURES = 5;

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function sha256(value: string) {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function derivePassword(password: string, salt: Uint8Array, iterations = ITERATIONS) {
  const pepper = process.env.AUTH_PASSWORD_PEPPER ?? "";
  const material = await crypto.subtle.importKey("raw", encoder.encode(password + pepper), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false; let difference = 0; for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index); return difference === 0;
}
export function readCookie(request: Request, name: string) {
  const item = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}
export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set("rr_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}
export function clearSessionCookie(response: NextResponse) {
  response.cookies.set("rr_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derivePassword(password, salt), salt: bytesToBase64(salt), iterations: ITERATIONS };
}
export async function verifyPassword(password: string, expected: string, salt: string, iterations: number) {
  return safeEqual(await derivePassword(password, base64ToBytes(salt), iterations), expected);
}
export async function newSession(userId: string) {
  const db = await readyDatabase(); const bytes = crypto.getRandomValues(new Uint8Array(32)); const token = bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); const now = Date.now();
  await db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(userId).run();
  await db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, await sha256(token), now + SESSION_SECONDS * 1000, now, now).run();
  return token;
}
export function safeNext(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /^[a-z][a-z\d+.-]*:/i.test(path)) return "/dashboard";
  try { const parsed = new URL(path, "https://reviewradar.invalid"); return parsed.origin === "https://reviewradar.invalid" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/dashboard"; } catch { return "/dashboard"; }
}
async function attemptKey(ip: string, email: string) { return sha256(`${ip.trim().slice(0, 80)}\n${email.trim().toLowerCase().slice(0, 254)}`); }
export async function authRateLimited(request: Request, email: string) {
  const db = await readyDatabase(), key = await attemptKey(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", email), now = Date.now();
  const row = await db.prepare("SELECT count, window_start FROM auth_attempts WHERE key=?").bind(key).first<{count:number;window_start:number}>();
  if (row && now - row.window_start < AUTH_WINDOW_MS && row.count >= AUTH_MAX_FAILURES) return { limited: true, key };
  if (row && now - row.window_start >= AUTH_WINDOW_MS) await db.prepare("UPDATE auth_attempts SET count=0,window_start=? WHERE key=?").bind(now,key).run();
  return { limited: false, key };
}
export async function recordAuthFailure(key: string) {
  const db = await readyDatabase(), now = Date.now();
  await db.prepare("INSERT INTO auth_attempts(key,count,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?-window_start>=? THEN 1 ELSE count+1 END,window_start=CASE WHEN ?-window_start>=? THEN ? ELSE window_start END").bind(key,now,now,AUTH_WINDOW_MS,now,AUTH_WINDOW_MS,now).run();
}
export async function clearAuthFailures(key: string) { const db = await readyDatabase(); await db.prepare("DELETE FROM auth_attempts WHERE key=?").bind(key).run(); }
export async function revokeAllSessions(request: Request) {
  const auth = await authenticatedUser(request); if (!auth) return false;
  const db = await readyDatabase(); await db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(auth.user.id).run(); return true;
}
export async function changePassword(request: Request, password: string) {
  const auth = await authenticatedUser(request); if (!auth) return false;
  const credential = await hashPassword(password), now=Date.now(), db=await readyDatabase();
  await db.batch([db.prepare("UPDATE password_credentials SET password_hash=?,salt=?,iterations=?,updated_at=? WHERE user_id=?").bind(credential.hash,credential.salt,credential.iterations,now,auth.user.id),db.prepare("DELETE FROM auth_sessions WHERE user_id=?").bind(auth.user.id)]);
  return true;
}
export async function authenticatedUser(request: Request) {
  const token = readCookie(request, "rr_session"); if (!token) return null; const db = await readyDatabase(); const now = Date.now();
  const row = await db.prepare("SELECT u.id, u.email, u.name FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1").bind(await sha256(token), now).first<{id:string;email:string;name:string|null}>();
  if (!row) return null; return { user: row, sessionToken: token };
}
export async function revokeSession(request: Request) {
  const token = readCookie(request, "rr_session"); if (!token) return; const db = await readyDatabase(); await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

