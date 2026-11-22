import { execFileSync } from "node:child_process";

const bucket = process.env.R2_BACKUP_BUCKET;
const endpoint = process.env.R2_ENDPOINT;
if (!bucket || !endpoint) throw new Error("R2_BACKUP_BUCKET and R2_ENDPOINT are required.");
const prefix = "d1/production/";
const retentionMs = 30 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - retentionMs;
let continuationToken;
let removed = 0;

do {
  const args = ["--endpoint-url", endpoint, "s3api", "list-objects-v2", "--bucket", bucket, "--prefix", prefix, "--output", "json"];
  if (continuationToken) args.push("--continuation-token", continuationToken);
  const page = JSON.parse(execFileSync("aws", args, { encoding: "utf8" }));
  for (const object of page.Contents ?? []) {
    if (!object.Key.endsWith(".sql") && !object.Key.endsWith(".json") && !object.Key.endsWith(".sha256")) continue;
    if (Date.parse(object.LastModified) >= cutoff) continue;
    execFileSync("aws", ["--endpoint-url", endpoint, "s3api", "delete-object", "--bucket", bucket, "--key", object.Key], { stdio: "inherit" });
    removed += 1;
  }
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (continuationToken);

process.stdout.write(`Removed ${removed} backup objects older than 30 days.\n`);
