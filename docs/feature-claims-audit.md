# Public feature and legal claims audit

Audit date: 2026-10-30. Statuses describe the code in this repository, not roadmap intent.

| Surface / claim | Status | Evidence / action |
| --- | --- | --- |
| Landing: connect and sync business reviews | Partial / works for Google Business Profile only | OAuth, location selection, queued sync, review import exist. Provider strip now names only Google. |
| Landing: Booking.com, Tripadvisor, Yelp, Facebook | Not available | Provider descriptions exist, but connect route returns 501 for non-Google providers. UI marks these providers “Coming soon”; feature flags default off. |
| Landing: AI topic clustering and sentiment | Not available | No review analysis worker or external AI call exists. Cards and preview are labeled “Coming soon” / illustrative; `aiAnalysis` defaults off. |
| Landing: anomaly detection and concrete recommended action | Not available | No generator runs. `anomalyDetection` and `actionRecommendations` default off; cards marked “Coming soon”. |
| Landing: multi-location | Works for selected Google locations | Google location selection and workspace-scoped location queries exist. |
| Landing: security, server secrets, workspace isolation | Partial | Server-side OAuth secrets and workspace checks exist. Avoid interpreting product copy as a security certification. |
| Dashboard: reviews, rating, local 30-day metrics | Works, subject to available imported data | `/api/app` and dashboard metrics calculate coverage from analyzed rows only and review dates in location timezones. |
| Dashboard: insights | Not available | Read API/table exists, but no job populates insights. UI is gated by `insights` (off by default) and says “Coming soon”. |
| Dashboard: alerts | Partial | Rule CRUD exists; no evaluator or delivery worker/channel integration exists. UI is gated by `alertDelivery` (off); write API returns 501 while disabled. |
| Dashboard: weekly reports | Not available | Table/read/export view exists but no generator or delivery worker populates it. UI is gated by `weeklyReports` (off). |
| Dashboard: Google sync progress and revoked/failed status | Works | Sync job status endpoint and UI polling exist. |
| Data export | Not available as an account export | A report JSON download exists only for generated report rows; there is no full workspace export endpoint. Privacy policy says self-service export is unavailable. |
| Privacy: review retention | Works for imported Google review rows | 30 days from first import; upsert preserves deadline; daily purge cron; disconnect deletes review rows and cascading related records. Account/session/security records have separate lifecycles. |
| Privacy: subprocessors | Matched to runtime | Cloudflare Workers + D1 are the coded hosting/database provider. Google is listed separately as the user-authorized OAuth/API source. No AI, email delivery, or alert delivery provider is called by runtime code. |
| Terms / privacy versions | Updated | Both legal pages show version 1.1 and effective date 2026-10-30. |

## Feature flag controls

`shared/feature-flags.ts` defines flags and safe defaults. Optional `NEXT_PUBLIC_FEATURE_*` build variables can opt in; do so only after the matching implementation and server route are ready. Current flags that default off: non-Google providers, AI analysis, anomaly detection, action recommendations, insights, alert delivery, weekly reports, and data export. Google is the only provider enabled by default.

## Retention scope

The 30-day rule applies to imported review rows and their dependent review content, analyses, and review-topic links. Account records and authentication/session/security data are not covered by that review-data timer. On Google disconnect the application removes provider review rows while revoking/deleting the Google connection. No blanket promise is made here about infrastructure-level backups or legal retention exceptions.

| Dashboard: reply publishing | Not available | No reply-write route or UI exists; integration card now labels it coming soon. |
