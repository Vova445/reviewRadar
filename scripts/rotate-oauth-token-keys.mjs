const baseUrl = process.env.APP_BASE_URL?.trim();
const secret = process.env.OAUTH_TOKEN_ROTATION_SECRET?.trim();

if (!baseUrl || !secret) {
  throw new Error("Set APP_BASE_URL and OAUTH_TOKEN_ROTATION_SECRET before running token rotation.");
}

const endpoint = new URL("/api/admin/rotate-oauth-tokens", baseUrl);
let cursor;
let pages = 0;
let scanned = 0;
let rotated = 0;
let alreadyCurrent = 0;
let concurrentChanges = 0;

while (true) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Origin: endpoint.origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cursor ? { cursor } : {}),
  });
  const report = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Rotation stopped on page ${pages + 1}: ${report.error ?? `${report.pending ?? response.status} token fields remain pending`}`);

  pages++;
  scanned += report.scanned ?? 0;
  rotated += report.rotated ?? 0;
  alreadyCurrent += report.alreadyCurrent ?? 0;
  concurrentChanges += report.concurrentChanges ?? 0;
  console.info(`Page ${pages}: scanned ${report.scanned}, rotated ${report.rotated}, already current ${report.alreadyCurrent}`);

  if (report.complete) {
    if (!report.verified || report.pending !== 0) throw new Error(`Rotation verification failed: ${report.pending} token fields still need rotation. Re-run the script.`);
    break;
  }
  if (typeof report.nextCursor !== "string" || report.nextCursor === cursor) throw new Error("Rotation stopped: invalid pagination cursor.");
  cursor = report.nextCursor;
}

console.info(JSON.stringify({ pages, scanned, rotated, alreadyCurrent, concurrentChanges, verified: true }));
