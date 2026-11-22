import { NextResponse } from "next/server";
import { isProviderConfigured, providerCapabilities } from "../../../server/provider-capabilities";
import { authenticatedUser } from "../../../server/d1-auth";
import { requireWorkspaceMember, requestedWorkspaceId } from "../../../server/workspace-auth";
import { readyDatabase } from "../../../server/d1";
import { featureFlags } from "../../../shared/feature-flags";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const member = await requireWorkspaceMember(auth.user.id, requestedWorkspaceId(request));
  if (!member) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  const db = await readyDatabase();
  const [connection, latestJob, lastSuccessfulSync] = await Promise.all([
    db.prepare("SELECT status,last_error FROM google_connections WHERE workspace_id=? LIMIT 1").bind(member.workspaceId).first<{status:string;last_error:string|null}>(),
    db.prepare("SELECT id,status,cursor,attempts,last_error,created_at,finished_at FROM sync_jobs WHERE workspace_id=? ORDER BY created_at DESC LIMIT 1").bind(member.workspaceId).first<{id:string;status:string;cursor:string|null;attempts:number;last_error:string|null;created_at:number;finished_at:number|null}>(),
    db.prepare("SELECT MAX(last_synced_at) last_synced_at FROM locations WHERE workspace_id=? AND provider='google'").bind(member.workspaceId).first<{last_synced_at:number|null}>(),
  ]);
  return NextResponse.json(
    providerCapabilities.map(({ envKeys: _envKeys, ...provider }) => ({
      ...provider,
      enabled: featureFlags[`${provider.id}Integration` as keyof typeof featureFlags],
      configured: isProviderConfigured({ ...provider, envKeys: _envKeys }),
      ...(provider.id === "google" ? { connectionStatus: connection?.status ?? "disconnected", connectionError: connection?.last_error ?? null, latestJob, lastSuccessfulSyncAt: lastSuccessfulSync?.last_synced_at ?? null, stale: !!lastSuccessfulSync?.last_synced_at && Date.now() - lastSuccessfulSync.last_synced_at > 24 * 60 * 60 * 1000 } : {}),
    })),
    { headers: { "Cache-Control": "no-store" } },
  );
}
