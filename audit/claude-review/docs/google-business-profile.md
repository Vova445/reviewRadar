# Google Business Profile integration

## Ownership model

`User → Workspace → Locations`. Provider credentials belong to a workspace, not directly to a user or location. A future `workspace_members` table supports employees and roles without changing ownership.

## OAuth flow

1. Create an OAuth state bound server-side to the signed-in user and workspace.
2. Redirect to Google OAuth 2.0 with the minimum Business Profile scopes.
3. Validate state and exchange the authorization code on the server.
4. Encrypt the refresh token before persistence. Never expose it to browser JavaScript.
5. Fetch accessible Business Profile accounts and locations.
6. Let the user select locations and store their provider IDs under the workspace.
7. Enqueue an initial review import per selected location.

An API key cannot read arbitrary businesses. Production access requires an eligible company, working domain and website, Google Cloud project, configured consent screen, enabled APIs, a valid business reason, and Google approval.

## Review synchronization

The scheduled worker runs every 30 minutes as a reconciliation mechanism:

`Scheduler → sync job → Google Business Profile → normalize → D1 → AI analysis`

Each job uses an idempotent upsert on `(location_id, provider_review_id)`, stores a provider cursor where available, backs off on rate limits, and refreshes expired access tokens server-side. Google notifications should enqueue high-priority jobs for new-review events; the scheduler remains the fallback for missed or delayed notifications.

Normalized reviews retain rating, comment, author display name, review time, provider ID, existing business reply, and a raw-content hash. AI analysis starts only after the database transaction succeeds.
