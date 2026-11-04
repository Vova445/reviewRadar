import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";

const shared = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../server/d1", () => ({ readyDatabase: async () => shared.db }));
vi.mock("../server/logger", () => ({ writeAuditEvent: async () => undefined }));

import { POST as login } from "../app/api/auth/login/route";
import { POST as register } from "../app/api/auth/register/route";
import { POST as reset } from "../app/api/auth/reset/route";
import { POST as connectGoogle } from "../app/v1/integrations/google/connect/route";
import { digest } from "../server/account-email";
import { authenticatedUser, changePassword, hashPassword, newSession, revokeAllSessions, revokeSession, verifyPassword } from "../server/d1-auth";
import { GET as googleCallback } from "../app/v1/integrations/google/callback/route";
import { GET as listGoogleLocations } from "../app/v1/integrations/google/locations/route";
import accountFixture from "./fixtures/google/accounts.json";
import locationFixture from "./fixtures/google/locations.json";
import rateLimitFixture from "./fixtures/google/errors/429.json";
import unauthorizedFixture from "./fixtures/google/errors/401.json";

let miniflare: Miniflare;
let db: D1Database;

async function createTestDatabase() {
  miniflare = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    compatibilityDate: "2025-01-01",
    d1Databases: { DB: `auth-test-${crypto.randomUUID()}` },
  });
  db = await miniflare.getD1Database("DB");
  shared.db = db;
  const statements = [
    "CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT,created_at INTEGER NOT NULL,email_verified_at INTEGER)",
    "CREATE TABLE password_credentials(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL,salt TEXT NOT NULL,iterations INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)",
    "CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,last_seen_at INTEGER NOT NULL)",
    "CREATE TABLE auth_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL)",
    "CREATE TABLE auth_tokens(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,purpose TEXT NOT NULL,target_email TEXT,expires_at INTEGER NOT NULL,used_at INTEGER,created_at INTEGER NOT NULL)",
    "CREATE TABLE workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,owner_user_id TEXT NOT NULL,created_at INTEGER NOT NULL)",
    "CREATE TABLE workspace_members(workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(workspace_id,user_id))",
    "CREATE TABLE oauth_states(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,return_url TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL)",
    "CREATE TABLE google_connections(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL UNIQUE,encrypted_refresh_token TEXT NOT NULL,encrypted_refresh_token_key_id TEXT,encrypted_access_token TEXT,encrypted_access_token_key_id TEXT,scopes TEXT NOT NULL,access_expires_at INTEGER,status TEXT NOT NULL,last_error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)",
    "CREATE TABLE google_available_locations(connection_id TEXT NOT NULL,account_name TEXT NOT NULL,location_name TEXT NOT NULL,title TEXT NOT NULL,address TEXT,selected INTEGER NOT NULL DEFAULT 0,discovered_at INTEGER NOT NULL,PRIMARY KEY(connection_id,location_name))",
  ];
  for (const statement of statements) await db.prepare(statement).run();
}

beforeEach(createTestDatabase);
afterEach(async () => { vi.unstubAllGlobals(); shared.db = undefined; await miniflare?.dispose(); });

describe("auth routes with Miniflare D1", () => {
  it("registers, rejects a wrong password, then creates a valid session", async () => {
    const response = await register(new Request("https://app.test/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.0.2.10" }, body: JSON.stringify({ email: "owner@example.com", name: "Workspace Owner", password: "correct horse battery" }) }));
    expect(response.status).toBe(200);
    expect((await db.prepare("SELECT email FROM users").first<{ email: string }>())?.email).toBe("owner@example.com");
    expect(await db.prepare("SELECT id FROM auth_sessions").first()).not.toBeNull();

    const wrong = await login(new Request("https://app.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.0.2.10" }, body: JSON.stringify({ email: "owner@example.com", password: "incorrect password" }) }));
    expect(wrong.status).toBe(401);
    const valid = await login(new Request("https://app.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.0.2.10" }, body: JSON.stringify({ email: "owner@example.com", password: "correct horse battery" }) }));
    expect(valid.status).toBe(200);
    expect(valid.headers.get("set-cookie")).toContain("rr_session=");
    expect(await db.prepare("SELECT count(*) count FROM auth_sessions").first<{ count: number }>()).toMatchObject({ count: 1 });
  });

  it("resets a password once, rejects replay and expiry, and revokes every session", async () => {
    const userId = "user-reset", now = Date.now(), token = "a".repeat(64), credential = await hashPassword("old password");
    await db.batch([
      db.prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)").bind(userId,"reset@example.com","Reset User",now),
      db.prepare("INSERT INTO password_credentials(user_id,password_hash,salt,iterations,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(userId,credential.hash,credential.salt,credential.iterations,now,now),
      db.prepare("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?),(?,?,?,?,?,?)").bind("s1",userId,"hash1",now+60_000,now,now,"s2",userId,"hash2",now+60_000,now,now),
      db.prepare("INSERT INTO auth_tokens(id,user_id,token_hash,purpose,expires_at,created_at) VALUES(?,?,?,'password_reset',?,?)").bind("t1",userId,await digest(token),now+60_000,now),
      db.prepare("INSERT INTO auth_tokens(id,user_id,token_hash,purpose,expires_at,created_at) VALUES(?,?,?,'password_reset',?,?)").bind("t2",userId,await digest("b".repeat(64)),now-1,now),
    ]);

    const body = { token, password: "new secure password" };
    const response = await reset(new Request("https://app.test/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    expect(response.status).toBe(200);
    expect((await db.prepare("SELECT COUNT(*) count FROM auth_sessions WHERE user_id=?").bind(userId).first<{ count: number }>())?.count).toBe(0);
    expect((await db.prepare("SELECT used_at FROM auth_tokens WHERE id='t1'").first<{ used_at: number | null }>())?.used_at).not.toBeNull();

    const replay = await reset(new Request("https://app.test/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    const expired = await reset(new Request("https://app.test/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: "b".repeat(64) }) }));
    expect(replay.status).toBe(400);
    expect(expired.status).toBe(400);
  });

  it("authenticates cookie sessions and revokes them on password change or logout", async () => {
    const userId = "user-session", now = Date.now(), credential = await hashPassword("initial password");
    await db.batch([
      db.prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)").bind(userId,"session@example.com","Session User",now),
      db.prepare("INSERT INTO password_credentials(user_id,password_hash,salt,iterations,created_at,updated_at) VALUES(?,?,?,?,?,?)").bind(userId,credential.hash,credential.salt,credential.iterations,now,now),
    ]);
    let token = await newSession(userId);
    let request = new Request("https://app.test/api/auth/session", { headers: { Cookie: `rr_session=${token}` } });
    await expect(authenticatedUser(request)).resolves.toMatchObject({ user: { id: userId, email: "session@example.com" } });
    expect(await changePassword(request, "updated password" )).toBe(true);
    expect(await db.prepare("SELECT COUNT(*) count FROM auth_sessions").first<{ count: number }>()).toMatchObject({ count: 0 });
    const updated = await db.prepare("SELECT password_hash,salt,iterations FROM password_credentials WHERE user_id=?").bind(userId).first<{ password_hash: string; salt: string; iterations: number }>();
    await expect(verifyPassword("updated password", updated!.password_hash, updated!.salt, updated!.iterations)).resolves.toBe(true);

    token = await newSession(userId);
    request = new Request("https://app.test/api/auth/session", { headers: { Cookie: `rr_session=${token}` } });
    expect(await revokeAllSessions(request)).toBe(true);
    expect(await db.prepare("SELECT COUNT(*) count FROM auth_sessions").first<{ count: number }>()).toMatchObject({ count: 0 });

    token = await newSession(userId);
    request = new Request("https://app.test/api/auth/session", { headers: { Cookie: `rr_session=${token}` } });
    await revokeSession(request);
    expect(await authenticatedUser(request)).toBeNull();
    expect(await authenticatedUser(new Request("https://app.test/api/auth/session"))).toBeNull();
  });

  it("creates an OAuth authorization URL and stores a one-time state with a local return path", async () => {
    const userId = "user-google", workspaceId = "workspace-google", now = Date.now();
    await db.batch([
      db.prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)").bind(userId,"google@example.com","Google User",now),
      db.prepare("INSERT INTO workspaces(id,name,owner_user_id,created_at) VALUES(?,?,?,?)").bind(workspaceId,"Google Workspace",userId,now),
      db.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'OWNER')").bind(workspaceId,userId),
    ]);
    const token = await newSession(userId);
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = "mock-client-id";
    try {
      const response = await connectGoogle(new Request("https://app.test/v1/integrations/google/connect", { method: "POST", headers: { Cookie: `rr_session=${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ returnUrl: "https://attacker.example/steal" }) }));
      expect(response.status).toBe(200);
      const body = await response.json() as { url: string };
      expect(body.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(new URL(body.url).searchParams.get("client_id")).toBe("mock-client-id");
      expect((await db.prepare("SELECT return_url FROM oauth_states").first<{ return_url: string }>())?.return_url).toBe("/integrations/google/locations");
    } finally {
      if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousClientId;
    }
  });

  it("mocks Google accounts and locations, completes OAuth, and lists locations from D1", async () => {
    const userId = "user-google-ok", workspaceId = "workspace-google-ok", now = Date.now(), envKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OAUTH_TOKEN_ENCRYPTION_KEYS"] as const;
    const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    await seedGoogleWorkspace(userId, workspaceId, now);
    process.env.GOOGLE_CLIENT_ID = "mock-client-id"; process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret"; process.env.OAUTH_TOKEN_ENCRYPTION_KEYS = JSON.stringify({ default: "test-encryption-secret-1234567890" });
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); requests.push(url);
      if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, scope: "https://www.googleapis.com/auth/business.manage" });
      if (url.startsWith("https://mybusinessaccountmanagement.googleapis.com/")) return Response.json(accountFixture);
      if (url.startsWith("https://mybusinessbusinessinformation.googleapis.com/")) return Response.json(locationFixture);
      return new Response("unexpected Google request", { status: 500 });
    }));
    try {
      const token = await newSession(userId), cookie = `rr_session=${token}`;
      const connect = await connectGoogle(new Request("https://app.test/v1/integrations/google/connect", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ returnUrl: "/onboarding?step=3" }) }));
      const state = new URL(((await connect.json()) as { url: string }).url).searchParams.get("state");
      const callback = await googleCallback(new Request(`https://app.test/v1/integrations/google/callback?code=mock-code&state=${state}`, { headers: { Cookie: cookie } }));
      expect(callback.headers.get("location")).toBe("https://app.test/onboarding?step=3");
      const result = await listGoogleLocations(new Request("https://app.test/v1/integrations/google/locations", { headers: { Cookie: cookie } }));
      expect(await result.json()).toMatchObject({ connected: true, locations: [{ location_name: "accounts/123456789/locations/987654321", title: "Northwind Cafe Kyiv" }] });
      expect(requests).toHaveLength(3);
      expect(requests[1]).toContain("mybusinessaccountmanagement.googleapis.com");
      expect(requests[2]).toContain("mybusinessbusinessinformation.googleapis.com");
    } finally {
      for (const key of envKeys) { const value = original[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  });

  it.each([[429, rateLimitFixture], [401, unauthorizedFixture]] as const)("surfaces a mocked Google API %s response", async (status, fixture) => {
    const userId = `user-google-${status}`, workspaceId = `workspace-google-${status}`, now = Date.now(), envKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "OAUTH_TOKEN_ENCRYPTION_KEYS"] as const;
    const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
    await seedGoogleWorkspace(userId, workspaceId, now);
    process.env.GOOGLE_CLIENT_ID = "mock-client-id"; process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret"; process.env.OAUTH_TOKEN_ENCRYPTION_KEYS = JSON.stringify({ default: "test-encryption-secret-1234567890" });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });
      if (url.startsWith("https://mybusinessaccountmanagement.googleapis.com/")) return new Response(JSON.stringify(fixture), { status });
      return Response.json(locationFixture);
    }));
    try {
      const cookie = `rr_session=${await newSession(userId)}`;
      const connect = await connectGoogle(new Request("https://app.test/v1/integrations/google/connect", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ returnUrl: "/onboarding?step=3" }) }));
      const state = new URL(((await connect.json()) as { url: string }).url).searchParams.get("state");
      const callback = await googleCallback(new Request(`https://app.test/v1/integrations/google/callback?code=mock-code&state=${state}`, { headers: { Cookie: cookie } }));
      expect(callback.headers.get("location")).toContain(`error=GOOGLE_API_${status}`);
    } finally {
      for (const key of envKeys) { const value = original[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
  });
});

async function seedGoogleWorkspace(userId: string, workspaceId: string, now: number) {
  await db.batch([
    db.prepare("INSERT INTO users(id,email,name,created_at) VALUES(?,?,?,?)").bind(userId,`${userId}@example.com`,`Google User ${userId}`,now),
    db.prepare("INSERT INTO workspaces(id,name,owner_user_id,created_at) VALUES(?,?,?,?)").bind(workspaceId,"Google Workspace",userId,now),
    db.prepare("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(?,?,'OWNER')").bind(workspaceId,userId),
  ]);
}
