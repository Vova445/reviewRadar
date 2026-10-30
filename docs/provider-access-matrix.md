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

Provider credentials stay in the Cloudflare Worker. The browser calls ReviewRadar's `/api/integrations/:provider/connect` route; implemented providers are handled by server-side route code and stored through the D1 `DB` binding. Missing credentials produce a disabled UI state; they never produce sample reviews or a fake `Connected` status.

## Worker contract

The Cloudflare Worker exposes authenticated application and integration routes:

- `GET /api/app` — authenticated workspace and dashboard aggregates from D1;
- `POST /v1/integrations/:provider/connect` — returns `{ "url": "https://..." }` for an authorization/onboarding flow;
- provider callbacks, encrypted credential storage, synchronization, retention cleanup, and audit logs.

Every endpoint must derive `workspace_id` from the authenticated session, never from an untrusted browser field.

## Future

Provider-specific external services may be evaluated after beta if ADR-001 review triggers are met. They are not required by the current Worker + D1 runtime.
