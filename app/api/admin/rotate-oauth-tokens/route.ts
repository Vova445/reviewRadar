import { NextResponse } from "next/server";
import { z } from "zod";
import { readyDatabase } from "../../../../server/d1";
import { rotateGoogleOAuthTokens } from "../../../../server/google-token-rotation";
import { assertSameOrigin, bodyTooLarge } from "../../../../server/security/request";

export const dynamic = "force-dynamic";
const requestSchema = z.object({ cursor: z.string().max(128).optional() }).strict();

function sameSecret(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function POST(request: Request) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;
  const sizeError = bodyTooLarge(request);
  if (sizeError) return sizeError;
  const secret = process.env.OAUTH_TOKEN_ROTATION_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "rotation_not_configured" }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || !sameSecret(authorization.slice(7), secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const report = await rotateGoogleOAuthTokens(await readyDatabase(), parsed.data.cursor ?? "");
    return NextResponse.json(report, { status: report.complete && !report.verified ? 409 : 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "rotation_failed" }, { status: 500 });
  }
}
