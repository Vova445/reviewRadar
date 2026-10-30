# Operations, providers, and security

MVP anomaly detection compares equal current and previous windows. A topic becomes an insight when growth is above 30% and minimum support is met. Zero-baseline topics use a separate support rule so division by zero never creates misleading infinite growth. Z-score, EWMA, and seasonality are deliberately deferred.

Google flow: OAuth → integration → account discovery → location discovery → explicit selection → queued initial sync → scheduled reconciliation. Multi-location jobs use batch review retrieval where supported. Notifications follow `verified webhook → deduplicated event → queue → fetch worker → database → AI worker → alert worker`.

Telegram supports `/start`, `/status`, `/reviews`, `/insights`, and `/settings`; the web application remains the primary UX. Email is behind a transactional-provider interface suitable for Resend or an equivalent service. Stripe subscription state changes only from verified, idempotent webhooks for checkout completion, subscription update/deletion, and failed invoices.

Security baseline: HTTPS, secure HttpOnly sessions, CSRF protection on cookie-authenticated mutations, strict Zod input validation, per-user and per-workspace rate limits, webhook signature verification, encrypted OAuth/Telegram destinations, RBAC, immutable audit events, and log redaction. Every repository query receives an authorized `workspace_id`; client-provided IDs never bypass the membership check. MVP grants only OWNER in the product UI, while the schema supports ADMIN, MANAGER, and VIEWER later.
