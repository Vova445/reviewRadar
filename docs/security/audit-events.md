# Audit events and logging

The D1 `audit_events` table records successful and failed login attempts, logout, Google connection and disconnection, review deletion (retention purge or disconnect), and role assignment when a workspace is created. `workspace_id` and `user_id` are nullable so a failed login for an unknown account can still be recorded. Metadata is allowlisted (`provider`, `resource`, `count`, `reason`, `outcome`, `from`, `to`, `reconnected`).

`server/logger.ts` redacts sensitive structured keys and credential-shaped strings before writing structured logs. Audit metadata is allowlisted and redacted before persistence. Never log request bodies, OAuth token responses, email addresses, or review text.

Set `AUDIT_IP_HASH_KEY` to a random secret in each environment to populate `ip_hash`; the raw Cloudflare `cf-connecting-ip` header is never stored. Without the key or header, `ip_hash` is null.

Server code must not use `console.log`; ESLint enforces this for `server/**/*.ts`. Use the redacting logger for operational events.
