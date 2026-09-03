import { NextResponse } from "next/server";
import { readyDatabase } from "./d1";

const ITERATIONS = 100_000;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

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
  await db.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), userId, await sha256(token), now + SESSION_SECONDS * 1000, now, now).run();
  return token;
}
export async function authenticatedUser(request: Request) {
  const token = readCookie(request, "rr_session"); if (!token) return null; const db = await readyDatabase(); const now = Date.now();
  const row = await db.prepare("SELECT u.id, u.email, u.name FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1").bind(await sha256(token), now).first<{id:string;email:string;name:string|null}>();
  if (!row) return null; return { user: row, sessionToken: token };
}
export async function revokeSession(request: Request) {
  const token = readCookie(request, "rr_session"); if (!token) return; const db = await readyDatabase(); await db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

