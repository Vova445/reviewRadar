# ReviewRadar production architecture

## Runtime boundaries

`Next.js UI → HTTPS API/BFF → PostgreSQL + Redis-compatible queue → workers`

The browser never calls the AI provider, Google Business Profile, PostgreSQL, or Redis directly. Next.js Route Handlers authenticate the user, resolve workspace membership, validate request input, and call the backend API. The API owns authorization and transactions. Workers own Google synchronization, AI analysis, anomaly detection, alerts, reports, and retention cleanup.

For the Sites-hosted frontend, PostgreSQL and Redis must stay behind the external HTTPS API because the hosting runtime does not support raw TCP database connections. The former D1 binding is disabled. `db/schema.ts` is retained only as prototype history; `db/postgres/001_initial.sql` is the production schema source.

## Queue pipeline

1. API stores a normalized review and commits.
2. API enqueues `review.analyze` with review/workspace/location IDs and an idempotency key.
3. AI worker loads temporary review content server-side.
4. Model returns schema-constrained JSON.
5. Zod validates strict types, enums, lengths, confidence, and `[-1,1]` scores.
6. One transaction stores analysis/topics and updates location statistics.
7. An alert job evaluates rules after analysis is committed.

Dead-letter queues retain identifiers and sanitized errors, not full Google review content. Every consumer is idempotent and retry-safe.

## Insights cost control

PostgreSQL performs deterministic aggregation over structured `review_topics`. It computes counts and growth between equal windows. Only anomalous clusters above configured support/confidence thresholds are sent to AI for a short explanation and recommended actions. The model is never asked to repeatedly analyze the entire review history.

## Secrets

OAuth tokens are envelope-encrypted before persistence; ciphertext and encryption key ID are stored, never plaintext refresh tokens. Data keys and provider secrets live in a managed secrets/KMS system. Logs must redact authorization headers, tokens, review text, AI prompts, and database URLs.
