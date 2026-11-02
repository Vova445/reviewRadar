import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { assertSameOrigin, bodyTooLarge } from "./server/security/request";

export function middleware(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (request.nextUrl.pathname === "/v1/integrations/google/notifications" || request.nextUrl.pathname === "/v1/jobs/google/sync") {
      const oversized = bodyTooLarge(request);
      if (oversized) return oversized;
    } else {
      const originError = assertSameOrigin(request);
      if (originError) return originError;
      const oversized = bodyTooLarge(request);
      if (oversized) return oversized;
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
