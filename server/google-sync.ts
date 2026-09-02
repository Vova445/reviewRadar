export type GoogleLocationRef = { accountName: string; locationName: string };
export interface GoogleSyncDependencies {
  google: { discoverAccounts(integrationId: string): Promise<string[]>; discoverLocations(account: string): Promise<GoogleLocationRef[]>; batchFetchReviews(locations: GoogleLocationRef[], pageToken?: string): Promise<{ reviews: unknown[]; nextPageToken?: string }> };
  queue: { add(name: "google.initial-sync" | "google.scheduled-sync", payload: object, options: { idempotencyKey: string }): Promise<void> };
}

export async function discoverGoogleLocations(integrationId: string, deps: GoogleSyncDependencies): Promise<GoogleLocationRef[]> {
  const accounts = await deps.google.discoverAccounts(integrationId);
  return (await Promise.all(accounts.map((account) => deps.google.discoverLocations(account)))).flat();
}

export async function enqueueSelectedLocations(integrationId: string, locations: GoogleLocationRef[], deps: GoogleSyncDependencies): Promise<void> {
  await deps.queue.add("google.initial-sync", { integrationId, locations }, { idempotencyKey: `initial-sync:${integrationId}` });
}
