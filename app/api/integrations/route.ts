import { NextResponse } from "next/server";
import { isProviderConfigured, providerCapabilities } from "../../../server/provider-capabilities";
import { authenticatedUser } from "../../../server/d1-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!await authenticatedUser(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    providerCapabilities.map(({ envKeys: _envKeys, ...provider }) => ({
      ...provider,
      configured: isProviderConfigured({ ...provider, envKeys: _envKeys }),
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
