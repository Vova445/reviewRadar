# D1 migration rollback plans

Cloudflare D1 migrations are forward-only in this repository. Do not put `.down.sql` files under `db/migrations`: Wrangler applies every matching migration file there. Rollback SQL and recovery plans belong here and must be reviewed before use.

| Migration | Forward change | Recovery plan |
| --- | --- | --- |
| `0001_auth.sql` | Creates password credentials and auth sessions. | Prefer a forward fix. If this was applied to an empty disposable D1 only, the recovery SQL is `DROP TABLE auth_sessions; DROP TABLE password_credentials;`. This drops sessions and credentials. |
| `0002_workspace_preferences.sql` | Creates locale/timezone preferences. | Prefer a forward fix. On an empty disposable D1, `DROP TABLE workspace_preferences;` removes saved preferences. |
| `0003_google_oauth.sql` | Creates Google connection, discovered-location, OAuth-state, and notification-event tables. | Revoke Google grants first. On an empty disposable D1 only, drop `google_available_locations`, `google_connections`, `oauth_states`, and `google_notification_events` in that order. Existing user tokens/data make this destructive; do not run on production. |
| `0004_schema_baseline.sql` | Idempotently creates the complete current schema for databases previously bootstrapped by the app and fresh D1 databases. | No general-purpose down migration. It may add missing tables and indexes on an existing database. Prefer a forward fix. For a fresh database with no application writes, discard/recreate that database. For production, use the pre-migration D1 backup or Time Travel only after confirming the restore point and data-loss window with the incident owner. |
| `0005_google_pubsub_push.sql` | Adds delivery state, lease, retry count, completion timestamp, and an index to Pub/Sub message deduplication records. | Forward-fix preferred. On a disposable D1 only, `DROP INDEX idx_google_notification_status_lease; ALTER TABLE google_notification_events DROP COLUMN completed_at; ALTER TABLE google_notification_events DROP COLUMN attempts; ALTER TABLE google_notification_events DROP COLUMN locked_until; ALTER TABLE google_notification_events DROP COLUMN status;`. These columns track queued/in-flight deliveries; dropping them while messages are pending can cause loss or duplicate synchronization. Never reverse this migration in production. |

## Release failure after migration

1. Stop any further migration/deploy jobs and capture the Worker version ID, `d1_migrations` rows, and current D1 backup/Time Travel bookmark.
2. If only Worker code is faulty, roll back the Worker to the previous tagged version. Do not reverse the D1 schema automatically.
3. Check whether the old Worker can run against the new schema. Prefer a forward-compatible hotfix or follow-up migration.
4. Restore D1 only when the migration corrupted data and the incident owner has approved the exact recovery point and known write-loss window. D1 data is not part of a Worker version rollback.
5. Re-run staging migrations and smoke checks before attempting production again.

All new migrations must add a row to the table above in the same pull request. If a migration has a safe inverse for a known disposable case, add its reviewed SQL under `db/rollbacks/` and document its data-loss effects here.
