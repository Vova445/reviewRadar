# Provider access matrix

This document is intentionally conservative: the product must not label a source as connected until a server-side verification call succeeds.

| Provider | Supported production path | Full review feed | Replies | Gate |
|---|---|---:|---:|---|
| Google Business Profile | Owner OAuth 2.0 → account/location discovery → review sync | Yes | Yes, after explicit owner approval | Google API approval and OAuth credentials |
| Yelp | Places API key for business matching and up to three review excerpts | No | No | Yelp API key; a separate data license is required for broader use |
| Tripadvisor | Content API key | Not treated as an owner inbox | No | Paid API account, key restrictions, and required attribution |
| Facebook | Meta app and Page authorization | Not enabled by default | Not enabled by default | Business verification/App Review and confirmation against the current Graph API version |
| Booking.com | Connectivity Review API with a machine account | Yes | Yes | Connectivity Partner onboarding and `review-api` permission |

## Runtime rule

Provider credentials stay on the server. The browser calls ReviewRadar's `/api/integrations/:provider/connect` route, which forwards to the production API. Missing credentials produce a disabled UI state; they never produce sample reviews or a fake `Connected` status.

## Backend contract

The external API configured by `REVIEWRADAR_API_BASE_URL` must expose:

- `GET /v1/app` — authenticated workspace and dashboard aggregates from PostgreSQL;
- `POST /v1/integrations/:provider/connect` — returns `{ "url": "https://..." }` for an authorization/onboarding flow;
- provider callbacks, encrypted credential storage, queue-backed synchronization, retention cleanup, and audit logs.

Every endpoint must derive `workspace_id` from the authenticated session, never from an untrusted browser field.
