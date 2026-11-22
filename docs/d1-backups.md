# D1 backups and restore drills

## Recovery targets

- **RPO target: 24 hours.** The production D1 SQL export runs daily at 02:17 UTC. The target is measured from the newest successful export; a missed or failed run can exceed it, so monitor failed `D1 production backup` workflow runs.
- **RTO target: 4 hours.** This is the operational target to identify a usable export, restore D1, validate row counts and application health, and return service. Large databases, Cloudflare API limits, or incident approval can extend it. These are internal targets, not provider guarantees; review them after each drill.

## Daily backup

`.github/workflows/d1-backup.yml` exports the production D1 database with Wrangler every day, generates a SHA-256 checksum and a per-table row-count manifest, uploads all three objects to the private R2 bucket, verifies the uploaded SQL object is non-empty, and removes backup objects older than 30 days. It can also be started with `workflow_dispatch`.

Configure repository variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `R2_BACKUP_BUCKET`

Configure repository secrets:

- `CLOUDFLARE_API_TOKEN` with D1 read access for the production database
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` for an R2 token scoped to the backup bucket

Keep the bucket private and restrict its credentials to this workflow. R2 applies server-side encryption at rest; exported SQL contains production data and must be treated as sensitive. The temporary export exists only on the hosted runner and should not be uploaded as a GitHub artifact.

## Monthly restore drill

`.github/workflows/d1-restore-drill.yml` runs monthly and can be started manually. It downloads the newest production export, verifies its checksum, creates a uniquely named disposable staging restore D1 database in the Cloudflare account's Eastern Europe location, restores the SQL, and compares every table's row count with the manifest generated from that export. It then deletes the temporary database. It does not overwrite the live staging database or attach the restored copy to a Worker.

The monthly workflow uses the same variables and R2 secrets as the daily backup. Its `CLOUDFLARE_API_TOKEN` additionally needs D1 create and delete permissions to provision and clean up the disposable drill database. A failed restore, row-count mismatch, or cleanup is a failed workflow. Each run writes a PII-free JSON report to `d1/restore-drills/` in R2 and to the GitHub Actions summary/artifact. Review the report and confirm that the temporary D1 database was removed; if cleanup failed, remove it manually in Cloudflare before rerunning.

## Manual recovery

1. Pause deploys and identify the incident time and required recovery point. Choose an export object under `d1/production/` and verify its `.sql.sha256` file.
2. Restore to a new or approved target D1 database using `npx wrangler d1 execute <database-name> --remote --file <backup.sql> --yes`. Do not import over a live database without an incident owner approving the data-loss window.
3. Apply any required schema migrations, verify table row counts and `/healthz` plus `/readyz`, then run controlled sign-in and sync checks.
4. Record the selected export timestamp, recovery duration, row-count comparison, application checks, and any data-loss window in the incident record. Do not include row content, credentials, tokens, or other personal data.

The monthly drill demonstrates export integrity and D1 restoration from SQL; it does not test application recovery end-to-end or guarantee that every external integration can be reconnected. The existing [release rollback runbook](runbook-release.md) covers Worker rollback separately.
