import { database } from "../../server/d1";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result=await database().prepare("SELECT 1 AS ok").first<{ok:number}>();
    if(result?.ok!==1)throw new Error("database_unavailable");
    return Response.json({status:"ready",checks:{database:"ok"}},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({status:"not_ready",checks:{database:"error"}},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
