# Google Pub/Sub push setup

Each Cloudflare environment has a dedicated `GOOGLE_SYNC_QUEUE` binding and Pub/Sub queue. Point the authenticated push subscription at:

`https://<environment-domain>/v1/integrations/google/notifications`

Configure the subscription to attach an OIDC token from a user-managed Google service account. Set the audience to that exact endpoint URL and set its email as `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL`. Set the same exact URL in `GOOGLE_PUBSUB_AUDIENCE` for the matching GitHub environment. The Cloud Pub/Sub service agent (`service-<project-number>@gcp-sa-pubsub.iam.gserviceaccount.com`) needs permission to mint tokens for this service account (Service Account Token Creator); the Pub/Sub identity creating the subscription needs permission to act as it.

The handler verifies the RS256 signature using Google's published keys, issuer, audience, service-account email, verified-email claim, expiration, and issued-at time. It validates the push envelope, reserves the Google message ID in D1, enqueues a compact event ID, then returns 204. A duplicate already queued or processed is acknowledged with 204. Invalid credentials return 401, malformed requests return 400, and transient database/queue failures return a non-2xx response so Pub/Sub retries. Queue retries use a dedicated dead-letter queue; notifications enqueue idempotent selected-location sync jobs, which the existing sync worker processes.

Deploy the worker and D1 migration before enabling the subscription. Configure the OIDC audience to match the public URL exactly, then grant the Pub/Sub service agent the token-minting role and create the authenticated push subscription. Keep the `google-push-*` dead-letter queues available for inspection and redrive.
