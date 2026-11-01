import { NextResponse } from "next/server";
import { syncAll } from "../../../../../server/google-business";

export async function POST(request: Request) {
  const expected = process.env.GOOGLE_SYNC_SECRET?.trim();
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const jobs = await syncAll();
  return NextResponse.json({ jobId: jobs[0] ?? null, jobIds: jobs }, { status: 202 });
}
