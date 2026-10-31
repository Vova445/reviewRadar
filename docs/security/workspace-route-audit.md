# Route and workspace query audit

Workspace scoped API routes accept an optional `x-workspace-id` header. Without it, the membership helper resolves the user's first workspace. Every workspace-scoped handler must resolve the authenticated user, call `requireWorkspaceMember` before accessing workspace data, and use the returned `workspaceId` in subsequent queries. Foreign or absent membership returns 404.

| Route | Methods | Database scope / workspace source | Cross-workspace result |
|---|---|---|---|
| `/api/app` | GET | `requireWorkspaceMember(user, header)`; analytics queries filter `workspace_id` from membership. | 404 |
| `/api/settings` | GET, PATCH | Same; preferences and workspace update use membership `workspace_id`; personal profile uses authenticated user id. | 404 |
| `/api/modules` | GET, POST, PATCH | Same; alerts/reports/insights queries and update filter `workspace_id`. | 404 |
| `/api/integrations` | GET | Authenticated user membership check; provider catalog is global metadata. | 404 |
| `/api/integrations/[provider]/connect` | POST | Google OAuth `ctx` checks member; state stores workspace id. | 404 via unauthorized result currently |
| `/v1/integrations/google` | DELETE | Google OAuth `ctx`; connection selected by workspace id; location revocation filters workspace id. | 404 via unauthorized result currently |
| `/v1/integrations/google/connect` | POST | Google OAuth `ctx`; OAuth state stores workspace id. | 404 via unauthorized result currently |
| `/v1/integrations/google/locations` | GET, POST | Google OAuth `ctx`; connection and available locations selected through workspace-bound connection id. | 404 via unauthorized result currently |
| `/v1/integrations/google/callback` | GET | OAuth state binds user id and workspace id, then updates connection using workspace id. | Redirects with error |
| `/v1/integrations/google/notifications` | POST | Google verification token; global event id, then server sync iterates each connection's workspace. | Not a user workspace route |
| `/v1/jobs/google/sync` | POST | Bearer secret; sync iterates each connection and carries its `workspace_id`. | Not a user workspace route |
| `/api/auth/*` | POST, GET | Identity/session records keyed by user/session; registration creates a new workspace. | Not a workspace route |

## SQL audit notes

- Dashboard queries constrain reviews, locations, topics, alerts, and reports by `workspace_id`.
- Alert updates use both resource id and `workspace_id`.
- Google connection lookups use `workspace_id`; Google locations are read/updated by the connection id obtained from that scoped connection. Sync joins selected provider locations to `locations` and carries the row's `workspace_id` into review writes. Location status updates include both location id and workspace id.
- The application currently has a single-workspace default in its UI; multi-workspace requests should pass `x-workspace-id` explicitly.
- Auth, OAuth callback, notification, and scheduled sync routes intentionally use identity or service credentials rather than a caller-selected workspace.
