# ReviewRadar execution roadmap

Status legend: `[x]` verified in the repository, `[~]` present but incomplete or prototype-only, `[ ]` not implemented. The status is evidence-based and should be updated in the same pull request that changes the implementation.

## Current product baseline

- [x] Marketing landing page, privacy policy and terms routes.
- [x] Email/password registration, login, logout and cookie session routes.
- [x] User, workspace, membership and workspace-preference persistence in D1.
- [x] Dashboard shell with overview, reviews, analytics, insights, alerts, reports, integrations and settings views.
- [x] Ukrainian/English UI toggle.
- [x] Google OAuth connect and callback routes at `/v1/integrations/google/connect` and `/v1/integrations/google/callback`.
- [x] OAuth state is random, hashed, workspace/user-bound, expiring and single-use.
- [x] Google refresh/access tokens are encrypted at rest before D1 persistence.
- [x] Google account/location discovery and explicit location selection UI.
- [x] Google review import with idempotent review upserts and access-token refresh.
- [x] Manual/scheduled Google sync endpoint protected by a bearer secret.
- [x] Google notification endpoint with verification token and event deduplication.
- [x] Disconnect flow revokes the token and removes the connection.
- [x] D1 schema/migrations for authentication, preferences and Google OAuth.
- [x] ADR-001 selects Cloudflare Workers + D1 as the single beta architecture.
- [x] Strict AI analysis schema, review-pipeline abstraction, anomaly calculation and insight SQL draft.
- [x] Stripe, email, Telegram and webhook domain abstractions/drafts.
- [x] Production build succeeds with Node 22+.
- [~] Lint exists, but the repository currently has 12 errors and 7 warnings.
- [ ] Automated unit, integration and end-to-end test suites.
- [ ] CI/CD quality gates and production deployment workflow.

## P0 — make the existing MVP safe and deployable

### P0-02 — reproducible build and green static gates

- [x] Rename the npm package to `reviewradar`.
- [x] Pin `@openai/sites-vite-plugin` to the exact installed version.
- [x] Make `npm run dev` cross-platform and retain the PowerShell path as `npm run dev:win`.
- [x] Add `typecheck` and `test` scripts.
- [x] Add Vitest configuration and executable anomaly-detection tests.
- [x] Fix all ESLint errors and warnings without blanket rule suppression; lint now enforces zero warnings.
- [x] Preserve the original lint baseline in `audit/p0-02/lint-before.txt`.
- [x] Verify clean install, lint, typecheck, test, build and HTTP 200 on Windows.
- [x] Verify the same locked build on Ubuntu through the OS-matrix quality workflow.

### P0-01 — README and ADR-001

- [x] Add a root README with product purpose, stack, Node requirement, first run, environment-variable names, commands and troubleshooting.
- [x] Add ADR-001 selecting Cloudflare Workers + D1 through beta, with consequences and measurable revisit triggers.
- [x] Align active architecture, provider and product documentation with ADR-001.
- [x] Move alternative PostgreSQL/Redis architecture language into explicitly future-only sections.
- [x] Add the browser → Worker → D1 → Google API Mermaid flow.
- [x] Independent reviewer launched the project strictly from README, received HTTP 200, and reported no remaining blocker.

### Runtime and architecture

- [x] Decide and document one beta data architecture: Cloudflare Worker + D1 (ADR-001).
- [x] Align README, environment examples and active architecture documentation with Worker + D1.
- [ ] Mark or archive non-runtime research schemas so they cannot be mistaken for beta deployment inputs.
- [ ] Add typed runtime configuration with startup validation for every required environment variable.
- [ ] Add separate local, preview and production configuration examples, including the exact Google callback URI for each environment.
- [ ] Add Wrangler/Cloudflare deployment configuration, D1 bindings, migrations, cron triggers and secret provisioning instructions.
- [ ] Pin and enforce Node `>=22.13.0` in local scripts and CI; fail early with a useful message on Node 20.

### Google OAuth and synchronization hardening

- [ ] Configure and verify both Google authorized redirect URIs exactly, without trailing slashes:
  - `http://localhost:4000/v1/integrations/google/callback`
  - `https://reviewradar.reviewradar-vova445.workers.dev/v1/integrations/google/callback`
- [ ] Verify the consent screen, test users, publishing status and approval for the `business.manage` scope.
- [ ] Verify required Google APIs are enabled and document quota/approval ownership.
- [ ] Replace synchronous location discovery and initial review sync in request handlers with queued jobs; return `202 Accepted` and expose job status.
- [ ] Add exponential backoff with jitter for 429/5xx responses and respect `Retry-After`.
- [ ] Add per-connection sync cursors/watermarks and incremental reconciliation instead of scanning all review pages every run.
- [ ] Prevent one failing connection from aborting notification processing for every workspace.
- [ ] Validate Pub/Sub push envelopes and audience/authentication; do not rely only on a query-string secret in production.
- [ ] Add token-key rotation support: decrypt by key ID and re-encrypt with the active key.
- [ ] Redact Google response bodies, tokens and review content from errors/logs.
- [ ] Add explicit reconnect/re-consent UX for revoked grants and `invalid_grant`.

### Authentication and web security

- [ ] Require a non-empty `AUTH_PASSWORD_PEPPER` outside local development.
- [ ] Add CSRF protection to all cookie-authenticated mutations, including integration connect/select/disconnect and settings updates.
- [ ] Add rate limits for registration, login, OAuth initiation, callback failures and sync endpoints.
- [ ] Rotate session identifiers after authentication and privilege changes; support session listing/revocation.
- [ ] Add email verification, password reset and account recovery.
- [ ] Add secure response headers: CSP, HSTS, frame restrictions, referrer policy and permissions policy.
- [ ] Validate every request body with Zod and return stable public error codes; never expose raw internal exception messages.
- [ ] Add immutable audit events for login, workspace changes, integration changes, exports and billing changes.

### Data correctness and privacy

- [ ] Replace request-time D1 schema creation with ordered, versioned D1 deployment migrations.
- [ ] Wrap connection/location selection and related writes in transactions where partial state is currently possible.
- [ ] Add database constraints for status enums, rating range, timestamp validity and workspace ownership.
- [ ] Implement retention as a scheduled job, not only as cleanup at the end of a successful Google sync.
- [ ] Add user/workspace deletion, token revocation and data-erasure workflows.
- [ ] Add encrypted backups, restore testing and documented recovery objectives.
- [ ] Define log retention and ensure logs never contain authorization headers, secrets, prompts or review text.

### Quality gates

- [ ] Fix all current ESLint errors/warnings and make `npm run lint` blocking.
- [ ] Add `typecheck`, `test`, `test:integration` and `test:e2e` scripts.
- [ ] Unit-test OAuth state, redirect URI equality, encryption, refresh, pagination, retries and idempotency.
- [ ] Integration-test every `/api` and `/v1` route with D1 and mocked Google APIs.
- [ ] E2E-test signup → login → connect Google → select location → import reviews → disconnect.
- [ ] Add GitHub Actions for install, lint, typecheck, tests, build, migration validation and secret scanning.
- [ ] Add dependency and license scanning plus automated updates.

## P1 — complete the promised v0.1 product loop

### Review ingestion and analysis

- [~] Review normalization and pipeline contracts exist; wire them into the real Google import path.
- [ ] Queue `review.analyze` after a committed new/changed review, with a deterministic idempotency key.
- [ ] Call the configured model server-side and validate output through `server/ai-analysis-schema.ts`.
- [ ] Persist sentiment, urgency, language, topics and confidence transactionally.
- [ ] Handle reviews without text deterministically and avoid unnecessary AI calls.
- [ ] Add retry/dead-letter behavior with sanitized errors and an operator replay flow.
- [ ] Track model, prompt version, latency, token usage and cost without storing unnecessary review text.

### Dashboard truthfulness

- [ ] Replace demo/empty-state assumptions with explicitly sourced live metrics.
- [ ] Add sync status, last successful sync, current job progress and actionable failure states per location.
- [ ] Implement review search, filters, pagination and location/date/rating/sentiment facets server-side.
- [ ] Add a review detail view with analysis evidence and existing Google reply.
- [ ] Ensure all charts use workspace timezone and stable period boundaries.
- [ ] Add loading, empty, partial-data, stale-data and permission-denied states for every module.
- [ ] Remove dead components and fix accessibility: keyboard navigation, focus states, landmarks, labels and contrast.

### Reputation Autopsy

- [ ] Compute the top three damaging topics using minimum support, confidence and equal comparison windows.
- [ ] Quantify current volume, prior volume, absolute change and percentage change with zero-baseline rules.
- [ ] Generate a short evidence-grounded explanation and recommended action for eligible clusters only.
- [ ] Show the reviews supporting each insight and let users mark an insight resolved/dismissed.
- [ ] Add a reproducible reputation score with documented components and versioning.

## P1 — operations, observability and launch readiness

- [ ] Add structured logs with request ID, workspace ID, job ID and provider operation, excluding sensitive content.
- [ ] Add error tracking and alerts for OAuth failure rate, sync lag, queue depth, job failure and webhook rejection.
- [ ] Add health/readiness endpoints that check bindings and dependencies safely.
- [ ] Add metrics for connected workspaces, selected locations, imported reviews, analysis throughput and cost.
- [ ] Create an operator runbook for Google outages, revoked tokens, quota exhaustion, failed migrations and key rotation.
- [ ] Add preview deployments and a staging Google OAuth client separate from production.
- [ ] Perform a threat model and privacy review before inviting external customers.
- [ ] Verify legal copy against actual retention, subprocessors, AI processing and deletion behavior.

## P2 — v0.2 monetization and engagement

### Billing and entitlements

- [~] Stripe webhook handling abstraction and plan documentation exist.
- [ ] Implement checkout and billing-portal endpoints.
- [ ] Verify Stripe signatures against the raw body and persist idempotent subscription events.
- [ ] Enforce entitlements server-side for locations, review history, AI insights, reports and channels.
- [ ] Add atomic usage counters and limits for imported reviews and AI operations.
- [ ] Add upgrade, downgrade, cancellation, payment-failure and grace-period UX.

### Alerts and reports

- [~] Alert-rule storage/UI, anomaly utility, email interface and Telegram command draft exist.
- [ ] Evaluate alert rules after analysis commits and deduplicate notifications.
- [ ] Implement transactional email provider and verified Telegram webhook/bot lifecycle.
- [ ] Add channel destination verification, quiet hours, timezone-aware delivery and unsubscribe controls.
- [ ] Generate immutable weekly report snapshots and deliver links, not mutable live queries.
- [ ] Implement CSV export with authorization, audit logging and safe formula escaping.

### Assisted replies

- [ ] Generate draft replies grounded in review text, business tone and language.
- [ ] Require explicit human approval before publishing any reply.
- [ ] Add policy checks, editable drafts, audit history and provider error handling.
- [ ] Verify Google API permissions and policy before enabling reply publication.

## P3 — v0.3 scale features

- [ ] Team invitations, member lifecycle and complete owner/admin/analyst/viewer RBAC UI.
- [ ] Multi-workspace switcher and agency/client isolation.
- [ ] Portfolio analytics across locations with drill-down and comparable periods.
- [ ] Competitor research using legally permitted/public data with provenance and freshness labels.
- [ ] Advanced analytics: cohorts, seasonality, EWMA and benchmarks only after sufficient data volume.
- [ ] Data exports and scheduled report delivery with plan-based limits.
- [ ] Additional providers only after API access, commercial terms, data rights and retention rules are verified.

## Recommended delivery sequence

1. **Foundation (1–2 weeks):** architecture decision, config validation, lint/typecheck, CI, migration ownership and security baseline.
2. **Reliable Google loop (1–2 weeks):** queued sync, retries, cursors, status UI, integration tests and production OAuth validation.
3. **Analysis loop (1–2 weeks):** persisted AI analysis, deterministic aggregation, Reputation Autopsy and cost telemetry.
4. **Launch hardening (1 week):** observability, retention/deletion, runbooks, staging and end-to-end tests.
5. **Paid v0.2 (2–4 weeks):** Stripe entitlements, alerts, reports, Telegram/email and assisted-reply drafts.

## Definition of done for every task

- [ ] Behavior is implemented server-side and cannot be bypassed by UI manipulation.
- [ ] Authorization and workspace isolation are tested.
- [ ] Inputs and external responses are validated.
- [ ] Retries/idempotency are defined for side effects.
- [ ] Logs and errors contain no secrets or retained review content.
- [ ] Unit/integration tests cover success and failure paths.
- [ ] User-facing loading, empty, error and recovery states exist.
- [ ] Documentation, environment examples and migration/deployment steps are updated.
- [ ] Lint, typecheck, tests and production build pass in CI.
