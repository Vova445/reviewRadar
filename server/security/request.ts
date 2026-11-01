import { NextResponse } from "next/server";

export const MAX_BODY_BYTES = 1_048_576;

export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  const configured = process.env.APP_BASE_URL?.trim();
  if (!origin || !configured) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    if (new URL(origin).origin !== new URL(configured).origin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export function bodyTooLarge(request: Request): NextResponse | null {
  const size = request.headers.get("content-length");
  return size && Number(size) > MAX_BODY_BYTES
    ? NextResponse.json({ error: "payload_too_large" }, { status: 413 })
    : null;
}
