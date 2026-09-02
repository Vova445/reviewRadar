import { NextResponse } from "next/server";
import { providerCapabilities, type ProviderId } from "../../../../../server/provider-capabilities";
import { authenticatedUser } from "../../../../../server/d1-auth";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { provider } = await context.params;
  const item = providerCapabilities.find((candidate) => candidate.id === provider);
  if (!item) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const baseUrl = process.env.REVIEWRADAR_API_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.INTERNAL_API_SIGNING_SECRET;
  if (!baseUrl || !secret || baseUrl.includes("example.com")) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }

  const response = await fetch(`${baseUrl}/v1/integrations/${provider as ProviderId}/connect`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: request.headers.get("cookie") ?? "",
      "X-ReviewRadar-User-ID": auth.user.id,
      "X-ReviewRadar-Internal-Secret": secret,
    },
    body: JSON.stringify({ returnUrl: new URL("/", request.url).toString() }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({ error: "invalid_backend_response" }));
  return NextResponse.json(payload, { status: response.status });
}
