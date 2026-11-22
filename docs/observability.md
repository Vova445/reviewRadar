# Observability

## Sentry setup

The Worker uses the official `@sentry/cloudflare` SDK and browser errors use `@sentry/browser`. Set the `SENTRY_DSN` secret in the Cloudflare environment, the same project DSN as `NEXT_PUBLIC_SENTRY_DSN` in the client build environment, and optionally set `SENTRY_ENVIRONMENT` (for example, `production`). Without these DSNs, JSON logs and health endpoints still work, while Sentry ingestion stays disabled.

The SDK drops identity, cookies, headers, request and response bodies, URL query values, database query values, queue payloads, generative AI inputs and outputs, and stack-frame locals. The final event filter also removes request context, breadcrumbs, extras, email addresses, and Google token patterns. Trace propagation to external hosts is disabled.

## Metrics and alerts

The Worker emits these Sentry metrics:

| Metric | Meaning |
| --- | --- |
| `sync.job.duration` | Time spent processing a Google sync job, in milliseconds |
| `sync.job.error` | A failed, retried, revoked, or source-missing sync job |
| `sync.jobs.failed` | Current number of jobs whose stored status is `failed` |
| `http.server.5xx` | Count of HTTP responses with status 500 or higher |

Create Sentry metric alert rules after adding the DSN:

- `sync.job.error` sum is above 0 during a 5 minute window: notify immediately.
- `http.server.5xx` sum is 5 or higher during a 5 minute window: notify on a 5xx spike.
- Optionally alert when `sync.jobs.failed` is above 0 for 10 minutes.

Configure email notifications on those rules. The Worker logs each response with its `request_id`; the same ID is returned in the `x-request-id` header. Cron and queue records also carry a generated request ID.

## Probes

- `GET /healthz` reports process liveness and does not depend on D1.
- `GET /readyz` runs `SELECT 1` against D1 and returns 503 when D1 is unavailable.

## Free plan check

Checked against Sentry's current pricing page on 2026-11-10: Developer includes 5,000 error events, 5 million spans, 5 GB each for logs and application metrics, 20 metric monitors, and a 30-day lookback. It is limited to one user. See [Sentry pricing](https://sentry.io/pricing/).
