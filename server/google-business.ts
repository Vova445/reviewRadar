import { authenticatedUser } from "./d1-auth";
import { readyDatabase } from "./d1";
import { requireWorkspaceMember, requestedWorkspaceId, WorkspaceRole } from "./workspace-auth";
import { resolveLocationTimezone } from "./dashboard-metrics";
import { logInfo, writeAuditEvent } from "./logger";
import { decryptProviderToken, encryptProviderToken } from "./token-encryption";
const E=new TextEncoder(),SCOPE="https://www.googleapis.com/auth/business.manage";
export const REVIEW_RETENTION_MS=30*24*60*60*1000;
type Conn={id:string;workspace_id:string;encrypted_refresh_token:string;encrypted_refresh_token_key_id:string|null;encrypted_access_token:string|null;encrypted_access_token_key_id:string|null;scopes:string;access_expires_at:number|null};
class GoogleHttpError extends Error { constructor(public status:number,message:string){super(message)} }
function env(n:string){const v=process.env[n]?.trim();if(!v)throw new Error("MISSING_"+n);return v}
function b64(b:Uint8Array){let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s)}
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",E.encode(s))),x=>x.toString(16).padStart(2,"0")).join("")}
export async function ctx(r:Request,manage=true){const a=await authenticatedUser(r);if(!a)return null;const member=await requireWorkspaceMember(a.user.id,requestedWorkspaceId(r),manage?WorkspaceRole.ADMIN:WorkspaceRole.MEMBER);if(!member)return null;const db=await readyDatabase(),w=await db.prepare("SELECT w.id,wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id=w.id WHERE wm.user_id=? AND w.id=? LIMIT 1").bind(a.user.id,member.workspaceId).first<{id:string;role:string}>();return w?{a,db,w}:null}
export function redirectUri(r:Request){return process.env.GOOGLE_REDIRECT_URI?.trim()||new URL("/v1/integrations/google/callback",r.url).toString()}
export async function authorize(r:Request,ret="/integrations/google/locations"){const c=await ctx(r);if(!c)return null;const st=b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""),now=Date.now(),u=new URL(ret,r.url),back=u.origin===new URL(r.url).origin?u.pathname+u.search:"/integrations/google/locations";await c.db.prepare("DELETE FROM oauth_states WHERE expires_at<=?").bind(now).run();await c.db.prepare("INSERT INTO oauth_states VALUES(?,?,?,?,?,?)").bind(await hash(st),c.a.user.id,c.w.id,back,now+600000,now).run();const q=new URLSearchParams({client_id:env("GOOGLE_CLIENT_ID"),redirect_uri:redirectUri(r),response_type:"code",scope:SCOPE,access_type:"offline",include_granted_scopes:"true",prompt:"consent",state:st});return"https://accounts.google.com/o/oauth2/v2/auth?"+q}
async function tokens(q:URLSearchParams){const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:q}),p=await r.json() as {access_token?:string;refresh_token?:string;expires_in?:number;scope?:string;error?:string};if(!r.ok||!p.access_token)throw new GoogleHttpError(r.status,"TOKEN_EXCHANGE_FAILED:"+String(p.error||r.status));return p as Required<Pick<typeof p,"access_token">>&typeof p}
async function api<T>(url:string,t:string){const r=await fetch(url,{headers:{Authorization:"Bearer "+t,Accept:"application/json"}});if(!r.ok)throw new GoogleHttpError(r.status,"GOOGLE_API_"+r.status+":"+(await r.text()).slice(0,200));return r.json() as Promise<T>}
async function discover(db:D1Database,id:string,t:string){let next:string|undefined;do{const p=await api<{accounts?:{name:string}[];nextPageToken?:string}>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20"+(next?"&pageToken="+encodeURIComponent(next):""),t);for(const a of p.accounts||[]){let n:string|undefined;do{const q=new URLSearchParams({readMask:"name,title,storefrontAddress",pageSize:"100"});if(n)q.set("pageToken",n);const x=await api<{locations?:{name:string;title?:string;storefrontAddress?:unknown}[];nextPageToken?:string}>("https://mybusinessbusinessinformation.googleapis.com/v1/"+a.name+"/locations?"+q,t);for(const l of x.locations||[]){const full=l.name.startsWith("accounts/")?l.name:a.name+"/"+l.name;await db.prepare("INSERT INTO google_available_locations(connection_id,account_name,location_name,title,address,selected,discovered_at) VALUES(?,?,?,?,?,COALESCE((SELECT selected FROM google_available_locations WHERE connection_id=? AND location_name=?),0),?) ON CONFLICT(connection_id,location_name) DO UPDATE SET title=excluded.title,address=excluded.address,discovered_at=excluded.discovered_at").bind(id,a.name,full,l.title||full,l.storefrontAddress?JSON.stringify(l.storefrontAddress):null,id,full,Date.now()).run()}n=x.nextPageToken}while(n)}next=p.nextPageToken}while(next)}
export async function callback(r:Request,code:string,state:string){
  const c=await ctx(r);if(!c)throw new Error("UNAUTHORIZED");
  const h=await hash(state),s=await c.db.prepare("SELECT * FROM oauth_states WHERE state_hash=?").bind(h).first<{user_id:string;workspace_id:string;return_url:string;expires_at:number}>();
  await c.db.prepare("DELETE FROM oauth_states WHERE state_hash=?").bind(h).run();
  if(!s||s.expires_at<Date.now()||s.user_id!==c.a.user.id||s.workspace_id!==c.w.id)throw new Error("INVALID_OAUTH_STATE");
  const t=await tokens(new URLSearchParams({code,client_id:env("GOOGLE_CLIENT_ID"),client_secret:env("GOOGLE_CLIENT_SECRET"),redirect_uri:redirectUri(r),grant_type:"authorization_code"}));
  const old=await c.db.prepare("SELECT id,encrypted_refresh_token,encrypted_refresh_token_key_id FROM google_connections WHERE workspace_id=?").bind(c.w.id).first<{id:string;encrypted_refresh_token:string;encrypted_refresh_token_key_id:string|null}>();
  if(!t.refresh_token&&!old)throw new Error("REFRESH_TOKEN_MISSING");
  const refreshPlaintext=t.refresh_token??await decryptProviderToken(old!.encrypted_refresh_token,old!.encrypted_refresh_token_key_id);
  const refresh=await encryptProviderToken(refreshPlaintext),accessToken=await encryptProviderToken(t.access_token);
  const id=old?.id||crypto.randomUUID(),now=Date.now();
  await c.db.prepare("INSERT INTO google_connections(id,workspace_id,encrypted_refresh_token,encrypted_refresh_token_key_id,encrypted_access_token,encrypted_access_token_key_id,scopes,access_expires_at,status,last_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'connected',NULL,?,?) ON CONFLICT(workspace_id) DO UPDATE SET encrypted_refresh_token=excluded.encrypted_refresh_token,encrypted_refresh_token_key_id=excluded.encrypted_refresh_token_key_id,encrypted_access_token=excluded.encrypted_access_token,encrypted_access_token_key_id=excluded.encrypted_access_token_key_id,scopes=excluded.scopes,access_expires_at=excluded.access_expires_at,status='connected',last_error=NULL,updated_at=excluded.updated_at")
    .bind(id,c.w.id,refresh.ciphertext,refresh.keyId,accessToken.ciphertext,accessToken.keyId,t.scope||SCOPE,now+(t.expires_in||3600)*1000,now,now).run();
  await discover(c.db,id,t.access_token);
  await writeAuditEvent({type:"connect",workspaceId:c.w.id,userId:c.a.user.id,meta:{provider:"google",reconnected:Boolean(old)},request:r},c.db);
  return s.return_url;
}
async function access(db:D1Database,c:Conn){
  if(c.encrypted_access_token&&(c.access_expires_at||0)>Date.now()+60000)return decryptProviderToken(c.encrypted_access_token,c.encrypted_access_token_key_id);
  const refresh=await decryptProviderToken(c.encrypted_refresh_token,c.encrypted_refresh_token_key_id);
  const t=await tokens(new URLSearchParams({refresh_token:refresh,client_id:env("GOOGLE_CLIENT_ID"),client_secret:env("GOOGLE_CLIENT_SECRET"),grant_type:"refresh_token"}));
  const encryptedAccess=await encryptProviderToken(t.access_token),now=Date.now();
  await db.prepare("UPDATE google_connections SET encrypted_access_token=?,encrypted_access_token_key_id=?,access_expires_at=?,status='connected',last_error=NULL,updated_at=? WHERE id=?")
    .bind(encryptedAccess.ciphertext,encryptedAccess.keyId,now+(t.expires_in||3600)*1000,now,c.id).run();
  return t.access_token;
}
export async function list(r:Request){const c=await ctx(r);if(!c)return null;const x=await c.db.prepare("SELECT id,status FROM google_connections WHERE workspace_id=?").bind(c.w.id).first<{id:string;status:string}>();if(!x)return{connected:false,locations:[]};const l=await c.db.prepare("SELECT account_name,location_name,title,address,selected FROM google_available_locations WHERE connection_id=? ORDER BY title").bind(x.id).all();return{connected:true,status:x.status,locations:l.results}}
const stars:Record<string,number>={ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};
const MAX_JOB_ATTEMPTS=8;
const LEASE_MS=120_000;
function retryDelay(attempt:number){const base=Math.min(6*60*60_000,30_000*2**Math.max(0,attempt-1));return base+Math.floor(Math.random()*Math.min(base*0.25,60_000))}
export async function enqueueLocationSync(db:D1Database,workspaceId:string,locationId:string,trigger="initial"){
  const existing=await db.prepare("SELECT id FROM sync_jobs WHERE location_id=? AND status IN ('queued','running','retry') LIMIT 1").bind(locationId).first<{id:string}>();
  if(existing)return existing.id;
  const id=crypto.randomUUID(),now=Date.now();
  try{await db.prepare("INSERT INTO sync_jobs(id,workspace_id,location_id,status,trigger_type,cursor,attempts,last_error,started_at,finished_at,created_at,locked_until,next_run_at) VALUES(?,?,?,'queued',?,NULL,0,NULL,NULL,NULL,?,NULL,?)").bind(id,workspaceId,locationId,trigger,now,now).run();return id}
  catch{const raced=await db.prepare("SELECT id FROM sync_jobs WHERE location_id=? AND status IN ('queued','running','retry') LIMIT 1").bind(locationId).first<{id:string}>();if(raced)return raced.id;throw new Error("SYNC_JOB_CREATE_FAILED")}
}
export async function enqueueAllSelectedSyncJobs(){
  const db=await readyDatabase(),rows=await db.prepare("SELECT l.workspace_id,l.id location_id FROM google_available_locations g JOIN google_connections c ON c.id=g.connection_id JOIN locations l ON l.workspace_id=c.workspace_id AND l.provider_location_id=g.location_name WHERE g.selected=1 AND c.status='connected'").all<{workspace_id:string;location_id:string}>();
  const jobs=[];for(const row of rows.results)jobs.push(await enqueueLocationSync(db,row.workspace_id,row.location_id,"manual"));return jobs;
}
type GoogleReview={reviewId:string;reviewer?:{displayName?:string};starRating:string;comment?:string;createTime:string;updateTime?:string;reviewReply?:{comment?:string;updateTime?:string}};
export async function saveReviewPage(db:D1Database,job:{id:string;workspace_id:string;location_id:string},items:GoogleReview[],leaseUntil:number){
  const now=Date.now();for(const review of items){
    const reviewId=await hash("google:"+job.location_id+":"+review.reviewId),expiry=now+REVIEW_RETENTION_MS;
    await db.batch([
      db.prepare("INSERT INTO reviews(id,workspace_id,location_id,source,source_review_id,rating,review_created_at,review_updated_at,source_fetched_at,content_expires_at,retention_until,created_at,updated_at) SELECT ?,?,?, 'google',?,?,?,?,?,?,?,?,? FROM sync_jobs j JOIN google_connections c ON c.workspace_id=j.workspace_id WHERE j.id=? AND j.status='running' AND j.locked_until=? AND c.status='connected' ON CONFLICT(source,location_id,source_review_id) DO UPDATE SET rating=excluded.rating,review_updated_at=excluded.review_updated_at,source_fetched_at=excluded.source_fetched_at,updated_at=excluded.updated_at WHERE reviews.retention_until>excluded.source_fetched_at").bind(reviewId,job.workspace_id,job.location_id,review.reviewId,stars[review.starRating]||1,Date.parse(review.createTime),review.updateTime?Date.parse(review.updateTime):null,now,expiry,expiry,now,now,job.id,leaseUntil),
      db.prepare("INSERT INTO review_source_content(review_id,author_name,comment,reply_text,reply_created_at,content_hash,purge_after) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM reviews r JOIN sync_jobs j ON j.id=? JOIN google_connections c ON c.workspace_id=j.workspace_id WHERE r.id=? AND r.retention_until>? AND j.status='running' AND j.locked_until=? AND c.status='connected') ON CONFLICT(review_id) DO UPDATE SET author_name=excluded.author_name,comment=excluded.comment,reply_text=excluded.reply_text,reply_created_at=excluded.reply_created_at,content_hash=excluded.content_hash WHERE EXISTS (SELECT 1 FROM reviews r JOIN sync_jobs j ON j.id=? JOIN google_connections c ON c.workspace_id=j.workspace_id WHERE r.id=excluded.review_id AND r.retention_until>? AND j.status='running' AND j.locked_until=? AND c.status='connected')").bind(reviewId,review.reviewer?.displayName||null,review.comment||null,review.reviewReply?.comment||null,review.reviewReply?.updateTime?Date.parse(review.reviewReply.updateTime):null,await hash(JSON.stringify(review)),expiry,job.id,reviewId,now,leaseUntil,job.id,now,leaseUntil)
    ]);
  }
}
export async function claimNextSyncJob(db:D1Database,now=Date.now()){
  const candidate=await db.prepare("SELECT id FROM sync_jobs WHERE status IN ('queued','running','retry') AND next_run_at<=? AND COALESCE(locked_until,0)<=? ORDER BY next_run_at,created_at LIMIT 1").bind(now,now).first<{id:string}>();
  if(!candidate)return null;
  const leaseUntil=now+LEASE_MS,claim=await db.prepare("UPDATE sync_jobs SET status='running',locked_until=?,started_at=COALESCE(started_at,?) WHERE id=? AND status IN ('queued','running','retry') AND next_run_at<=? AND COALESCE(locked_until,0)<=?").bind(leaseUntil,now,candidate.id,now,now).run();
  return claim.meta.changes?{id:candidate.id,leaseUntil}:null;
}
export async function processNextSyncJob(database?:D1Database){
  const db=database??await readyDatabase(),claim=await claimNextSyncJob(db);
  if(!claim)return {processed:false};
  const leaseUntil=claim.leaseUntil;
  const job=await db.prepare("SELECT j.id,j.workspace_id,j.location_id,j.cursor,j.attempts,c.id connection_id,c.encrypted_refresh_token,c.encrypted_refresh_token_key_id,c.encrypted_access_token,c.encrypted_access_token_key_id,c.scopes,c.access_expires_at,c.status connection_status,g.location_name FROM sync_jobs j JOIN locations l ON l.id=j.location_id AND l.workspace_id=j.workspace_id JOIN google_connections c ON c.workspace_id=j.workspace_id JOIN google_available_locations g ON g.connection_id=c.id AND g.location_name=l.provider_location_id WHERE j.id=?").bind(claim.id).first<{id:string;workspace_id:string;location_id:string;cursor:string|null;attempts:number;connection_id:string;encrypted_refresh_token:string;encrypted_refresh_token_key_id:string|null;encrypted_access_token:string|null;encrypted_access_token_key_id:string|null;scopes:string;access_expires_at:number|null;connection_status:string;location_name:string}>();
  if(!job){await db.prepare("UPDATE sync_jobs SET status='failed',last_error='sync_source_missing',error='sync_source_missing',finished_at=?,locked_until=NULL WHERE id=? AND locked_until=?").bind(Date.now(),claim.id,leaseUntil).run();return {processed:true,status:"failed"}}
  if(job.connection_status==="revoked") {await db.prepare("UPDATE sync_jobs SET status='revoked',finished_at=?,locked_until=NULL,last_error='integration_revoked' WHERE id=? AND locked_until=?").bind(Date.now(),job.id,leaseUntil).run();return {processed:true,status:"revoked"}}
  const conn:Conn={id:job.connection_id,workspace_id:job.workspace_id,encrypted_refresh_token:job.encrypted_refresh_token,encrypted_refresh_token_key_id:job.encrypted_refresh_token_key_id,encrypted_access_token:job.encrypted_access_token,encrypted_access_token_key_id:job.encrypted_access_token_key_id,scopes:job.scopes,access_expires_at:job.access_expires_at};
  try{
    const token=await access(db,conn),query=new URLSearchParams({pageSize:"50",orderBy:"updateTime desc"});if(job.cursor)query.set("pageToken",job.cursor);
    const page=await api<{reviews?:{reviewId:string;reviewer?:{displayName?:string};starRating:string;comment?:string;createTime:string;updateTime?:string;reviewReply?:{comment?:string;updateTime?:string}}[];nextPageToken?:string}>("https://mybusiness.googleapis.com/v4/"+job.location_name+"/reviews?"+query,token);
    await saveReviewPage(db,job,page.reviews||[],leaseUntil);
    const complete=!page.nextPageToken,stamp=Date.now();
    await db.batch([
      db.prepare("UPDATE sync_jobs SET status=?,cursor=?,last_error=NULL,error=NULL,locked_until=NULL,next_run_at=?,finished_at=? WHERE id=? AND status='running' AND locked_until=?").bind(complete?"completed":"queued",page.nextPageToken||null,stamp,complete?stamp:null,job.id,leaseUntil),
      ...(complete?[db.prepare("UPDATE locations SET status='connected',last_synced_at=?,review_count=(SELECT COUNT(*) FROM reviews WHERE workspace_id=? AND location_id=?),rating=(SELECT AVG(rating) FROM reviews WHERE workspace_id=? AND location_id=?) WHERE id=? AND workspace_id=? AND EXISTS(SELECT 1 FROM google_connections WHERE workspace_id=? AND status='connected')").bind(stamp,job.workspace_id,job.location_id,job.workspace_id,job.location_id,job.location_id,job.workspace_id,job.workspace_id)]:[])
    ]);
    return {processed:true,status:complete?"completed":"queued",jobId:job.id};
  }catch(error){
    const status=error instanceof GoogleHttpError?error.status:0,message=String(error).slice(0,500),stamp=Date.now();
    if(status===401||(status===400&&message.includes("invalid_grant"))){await db.batch([db.prepare("UPDATE google_connections SET status='revoked',last_error=?,updated_at=? WHERE id=? AND workspace_id=?").bind(message,stamp,job.connection_id,job.workspace_id),db.prepare("UPDATE locations SET status='revoked' WHERE id=? AND workspace_id=?").bind(job.location_id,job.workspace_id),db.prepare("UPDATE sync_jobs SET status='revoked',last_error=?,error=?,finished_at=?,locked_until=NULL WHERE id=? AND locked_until=?").bind(message,message,stamp,job.id,leaseUntil)]);return {processed:true,status:"revoked",jobId:job.id}}
    const retry=status===429||status>=500||status===0,attempts=job.attempts+1,terminal=!retry||attempts>=MAX_JOB_ATTEMPTS,next=stamp+retryDelay(attempts);
    await db.prepare("UPDATE sync_jobs SET status=?,attempts=?,last_error=?,error=?,next_run_at=?,finished_at=?,locked_until=NULL WHERE id=? AND status='running' AND locked_until=?").bind(terminal?"failed":"retry",attempts,message,message,next,terminal?stamp:null,job.id,leaseUntil).run();
    return {processed:true,status:terminal?"failed":"retry",jobId:job.id};
  }
}
export async function select(r:Request,names:string[]){const c=await ctx(r);if(!c)return null;const x=await c.db.prepare("SELECT * FROM google_connections WHERE workspace_id=?").bind(c.w.id).first<Conn>();if(!x)throw new Error("NOT_CONNECTED");const rows=await c.db.prepare("SELECT location_name,title,address FROM google_available_locations WHERE connection_id=?").bind(x.id).all<{location_name:string;title:string;address:string|null}>(),valid=rows.results.filter(v=>names.includes(v.location_name));if(!valid.length)throw new Error("NO_LOCATIONS");const preferences=await c.db.prepare("SELECT timezone FROM workspace_preferences WHERE workspace_id=? LIMIT 1").bind(c.w.id).first<{timezone:string}>(),fallbackTimezone=preferences?.timezone||"Europe/Kyiv";await c.db.prepare("UPDATE google_available_locations SET selected=0 WHERE connection_id=?").bind(x.id).run();const jobs:string[]=[];for(const l of valid){let a:{locality?:string;administrativeArea?:string;regionCode?:string}={};try{a=JSON.parse(l.address||"{}")}catch{}const timezone=resolveLocationTimezone(a,fallbackTimezone),id=await hash("google:"+c.w.id+":"+l.location_name);await c.db.batch([c.db.prepare("UPDATE google_available_locations SET selected=1 WHERE connection_id=? AND location_name=?").bind(x.id,l.location_name),c.db.prepare("INSERT INTO locations(id,workspace_id,provider,provider_location_id,name,city,country,timezone,status,created_at) VALUES(?,?,'google',?,?,?,?,?,'pending',?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,city=excluded.city,country=excluded.country,timezone=excluded.timezone,status='pending'").bind(id,c.w.id,l.location_name,l.title,a.locality||a.administrativeArea||null,a.regionCode||null,timezone,Date.now())]);jobs.push(await enqueueLocationSync(c.db,c.w.id,id,"initial"))}return{selected:valid.length,jobs}}
export async function syncAll(){return enqueueAllSelectedSyncJobs()}
export async function purgeExpiredReviews(db:D1Database,now=Date.now()){
  const groups=await db.prepare("SELECT workspace_id,COUNT(*) count FROM reviews WHERE retention_until<=? GROUP BY workspace_id").bind(now).all<{workspace_id:string;count:number}>();
  const result=await db.prepare("DELETE FROM reviews WHERE retention_until<=?").bind(now).run();
  const deleted=result.meta.changes;
  for(const group of groups.results)await writeAuditEvent({type:"delete",workspaceId:group.workspace_id,meta:{resource:"expired_reviews",count:Number(group.count),reason:"retention_purge"}},db);
  logInfo("review_retention_purge",{deleted,runAt:now});
  return deleted;
}
export async function disconnect(r:Request){
  const c=await ctx(r);if(!c)return false;
  const connection=await c.db.prepare("SELECT * FROM google_connections WHERE workspace_id=?").bind(c.w.id).first<Conn>();
  if(!connection)return true;
  try{
    await fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(await decryptProviderToken(connection.encrypted_refresh_token,connection.encrypted_refresh_token_key_id)),{method:"POST"});
  }finally{
    const now=Date.now();
    const count=await c.db.prepare("SELECT COUNT(*) count FROM reviews WHERE workspace_id=? AND source='google' AND location_id IN (SELECT id FROM locations WHERE workspace_id=? AND provider='google')").bind(c.w.id,c.w.id).first<{count:number}>();
    await c.db.batch([
      c.db.prepare("UPDATE sync_jobs SET status='revoked',last_error='integration_disconnected',error='integration_disconnected',finished_at=?,locked_until=NULL WHERE workspace_id=? AND location_id IN (SELECT id FROM locations WHERE workspace_id=? AND provider='google') AND status IN ('queued','running','retry')").bind(now,c.w.id,c.w.id),
      c.db.prepare("DELETE FROM reviews WHERE workspace_id=? AND source='google' AND location_id IN (SELECT id FROM locations WHERE workspace_id=? AND provider='google')").bind(c.w.id,c.w.id),
      c.db.prepare("DELETE FROM google_connections WHERE id=? AND workspace_id=?").bind(connection.id,c.w.id),
      c.db.prepare("UPDATE locations SET status='revoked' WHERE workspace_id=? AND provider='google'").bind(c.w.id),
    ]);
    await writeAuditEvent({type:"disconnect",workspaceId:c.w.id,userId:c.a.user.id,meta:{provider:"google"},request:r},c.db);
    if(Number(count?.count??0)>0)await writeAuditEvent({type:"delete",workspaceId:c.w.id,userId:c.a.user.id,meta:{resource:"google_reviews",count:Number(count?.count??0),reason:"integration_disconnect"},request:r},c.db);
  }
  return true;
}
