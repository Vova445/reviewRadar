import { NextResponse } from "next/server";
import { authenticatedUser, verifyPassword } from "../../../../server/d1-auth";
import { readyDatabase } from "../../../../server/d1";
import { writeAuditEvent } from "../../../../server/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth=await authenticatedUser(request);
  if(!auth)return NextResponse.json({error:"unauthorized"},{status:401});
  const db=await readyDatabase();
  const job=await db.prepare("SELECT status FROM account_deletion_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(auth.user.id).first<{status:string}>();
  return NextResponse.json({status:job?.status??null},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as {password?: unknown} | null;
  if (typeof body?.password !== "string" || body.password.length > 256) return NextResponse.json({ error: "invalid_confirmation" }, { status: 400 });
  const db = await readyDatabase();
  const credential = await db.prepare("SELECT password_hash,salt,iterations FROM password_credentials WHERE user_id=? LIMIT 1").bind(auth.user.id).first<{password_hash:string;salt:string;iterations:number}>();
  if (!credential || !await verifyPassword(body.password, credential.password_hash, credential.salt, credential.iterations)) return NextResponse.json({ error: "invalid_confirmation" }, { status: 403 });
  const shared = await db.prepare("SELECT 1 AS found FROM workspace_members wm JOIN workspaces w ON w.id=wm.workspace_id WHERE wm.user_id=? AND w.owner_user_id=? AND EXISTS(SELECT 1 FROM workspace_members other WHERE other.workspace_id=w.id AND other.user_id!=?) LIMIT 1").bind(auth.user.id,auth.user.id,auth.user.id).first();
  if (shared) return NextResponse.json({ error: "workspace_has_other_members" }, { status: 409 });
  const existing = await db.prepare("SELECT id FROM account_deletion_jobs WHERE user_id=? AND status IN ('queued','retry','running') LIMIT 1").bind(auth.user.id).first<{id:string}>();
  if (existing) return NextResponse.json({ ok: true, jobId: existing.id }, { status: 202 });
  const membership = await db.prepare("SELECT id workspace_id FROM workspaces WHERE owner_user_id=? ORDER BY created_at LIMIT 1").bind(auth.user.id).first<{workspace_id:string}>();
  const now = Date.now(), jobId = crypto.randomUUID();
  await db.prepare("INSERT INTO account_deletion_jobs(id,user_id,workspace_id,status,attempts,next_run_at,last_error,created_at,updated_at) VALUES(?,?,?,'queued',0,?,NULL,?,?)").bind(jobId,auth.user.id,membership?.workspace_id??null,now,now,now).run();
  await writeAuditEvent({ type:"delete", workspaceId:membership?.workspace_id,userId:auth.user.id,meta:{resource:"account",reason:"user_requested"} },db);
  return NextResponse.json({ ok:true,jobId },{status:202,headers:{"Cache-Control":"no-store"}});
}
