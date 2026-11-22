# Runbook: production broke after a release

Use this when a production release causes elevated 5xx responses, failed readiness checks, broken sign-in/integration flows, or failed synchronization jobs.

## Stabilize and identify the release

1. Pause/cancel later production runs in GitHub Actions. Do not start another migration while assessing the incident.
2. Open the failed/suspect workflow run and note its commit SHA and Worker version ID. In Cloudflare, inspect the Worker deployment history and identify the last known-good version ID. The workflow tags each deployed immutable version with its full commit SHA.
3. Check `/healthz` and `/readyz`, Sentry, structured logs by `request_id`, and sync job failure counts. Determine whether the failure is Worker code, configuration/secrets, or D1 schema/data.

## Roll back Worker code

If the issue is in Worker code/configuration and the previous version is compatible with the current D1 schema, roll back the Worker only. From an operator shell authenticated to the correct Cloudflare account, use the production Wrangler config and the known-good version ID:

```sh
npx wrangler rollback <KNOWN_GOOD_VERSION_ID> --config .wrangler/wrangler-production.json --message "Incident rollback <INCIDENT_ID>"
```

The checked-in Wrangler file intentionally contains placeholders. Generate the ignored production config first with `node scripts/prepare-cloudflare-deployment.mjs production` after setting the same `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `APP_BASE_URL`, `GOOGLE_REDIRECT_URI`, and required application secrets listed in the README. Do not paste secret values into the terminal command, incident notes, or logs. Obtain version IDs from Cloudflare's Worker versions/deployments view or `npx wrangler versions list --name reviewradar-production`.

`wrangler rollback` creates a new deployment using the old version's code/configuration. It does **not** reverse D1 migrations or restore database rows. Once rolled back, check `/healthz`, `/readyz`, authentication, Google integration status, and one controlled sync. Continue monitoring 5xx and failed sync jobs.

## If a D1 migration is involved

1. Keep the Worker stable and stop repeated migration attempts. Record the `d1_migrations` state, migration filename, and the D1 backup/Time Travel restore point.
2. Prefer a forward-only corrective migration that remains compatible with the deployed Worker. Rehearse it locally, apply it to staging, validate there, then use the protected production approval.
3. If data was corrupted and a restore is necessary, have the incident owner choose the exact D1 backup/Time Travel restore point and explicitly accept its write-loss window. Restore is a data operation independent of Worker rollback. Follow Cloudflare's current D1 recovery procedure and verify row counts and application flows afterward.
4. Never run destructive inverse SQL against production as a routine rollback. The per-migration recovery notes are in `db/rollbacks/README.md`.

## Resume releases

After service is stable, open a fix PR. CI rehearses migrations on isolated local D1 and dry-runs the Worker upload. Merge to `main` only when staging migration/deploy and its smoke checks pass; production waits on the GitHub `production` environment's required reviewer approval. Add a migration rollback/recovery note in the same PR as every new migration.

## Escalation evidence

Capture the incident time window, release SHA and Worker version ID, request IDs, affected endpoints, migration state, sync failure counts, chosen recovery point, and recovery validation. Audit/incident records must omit credentials, tokens, email addresses, review content, and other personal data.
